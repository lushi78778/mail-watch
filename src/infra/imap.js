// 邮箱基础设施层：负责与邮箱进行交互
const { ImapFlow } = require('imapflow');

const DEFAULT_AI_PROMPT = [
  '输入是单封邮件的 JSON，包含 uid/subject/date。',
  '请输出 JSON 对象，格式：{"time":"<date>","code":"<code>"}。',
  '若未找到验证码，返回空 JSON 对象 {}。',
  '如果是密码重置类邮件（password reset / reset code），必须返回空 JSON 对象 {}。',
  '必须从 subject 中提取验证码。',
].join('\n');

// 创建邮件客户端实例
function createImapClient({ host, port, tls, user, pass }) {
  return new ImapFlow({ host, port, secure: tls, auth: { user, pass } });
}

function clampText(text, maxLen) {
  const s = String(text || '');
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

function logPerf(cfg, label, start) {
  if (!cfg?.log?.perf) return;
  const ms = Date.now() - start;
  console.log(`[PERF] ${label} ${ms}ms`);
}

function isPasswordResetSubject(subject) {
  const s = String(subject || '');
  return /password\s*reset|reset\s*code/i.test(s) || /密码.*(重置|找回)|重置.*密码/.test(s);
}

function isWhitelistedSubject(subject, whitelist) {
  if (!whitelist || whitelist.length === 0) return true;
  const s = String(subject || '');
  return whitelist.some((term) => s.toLowerCase().includes(term.toLowerCase()));
}
async function extractCaptchaWithAI(message, ai) {
  if (!ai?.apiKey || !message) return null;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(ai.timeoutMs) ? ai.timeoutMs : 15_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const baseUrl = String(ai.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
    const endpoint = `${baseUrl}/v1/chat/completions`;
    const payloadMax = Number.isFinite(ai.payloadMax) ? ai.payloadMax : 2000;
    const payload = clampText(
      JSON.stringify({
        uid: message.uid,
        subject: message.subject || '',
        date: message.date || '',
      }),
      payloadMax,
    );
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ai.apiKey}`,
    };
    if (ai.disableCache) {
      headers['Cache-Control'] = 'no-store, no-cache, max-age=0';
      headers.Pragma = 'no-cache';
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ai.model || 'deepseek-chat',
        temperature: 0,
        max_tokens: Number.isFinite(ai.maxTokens) ? ai.maxTokens : 64,
        response_format: { type: 'json_object' },
        user: `mw_${message.uid}_${Date.now()}`,
        metadata: { uid: message.uid },
        messages: [
          { role: 'system', content: ai.prompt || DEFAULT_AI_PROMPT },
          { role: 'user', content: payload },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = new Error(`AI request failed: ${res.status}`);
      err.code = 'AI';
      throw err;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const result = String(content || '').trim();
    if (ai.log) {
      const elapsed = Date.now() - startedAt;
      console.log(
        `[AI] uid=${message.uid ?? '-'} model=${ai.model || 'deepseek-chat'} ms=${elapsed} result=${JSON.stringify(result || '')}`,
      );
    }
    return result || null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeCaptcha(result) {
  if (!result) return false;
  if (typeof result === 'object') {
    if (result.code) return JSON.stringify(result);
    return null;
  }
  const text = String(result).trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.code) {
      return JSON.stringify(parsed);
    }
    return null;
  } catch {
    return text;
  }
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

// 拉取邮件：仅最近 3 天，按数量截取，按时间倒序
async function fetchMessages({ limit = 3 }, cfg) {
  const { host, port, tls, user, pass } = cfg.imap;
  if (!host || !user || !pass) {
    const err = new Error('Missing IMAP configuration. Set host/user/pass.');
    err.code = 'CONFIG';
    throw err;
  }
  const client = createImapClient({ host, port, tls, user, pass });
  try {
    const t0 = Date.now();
    await client.connect();
    logPerf(cfg, 'imap.connect', t0);
    const t1 = Date.now();
    await client.mailboxOpen('INBOX');
    logPerf(cfg, 'imap.mailboxOpen', t1);
    const t2 = Date.now();
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    let uids = await client.search({ since });
    logPerf(cfg, 'imap.search', t2);
    if (!uids || uids.length === 0) return [];
    const lastUids = uids.slice(-Math.min(limit, 3));
    const items = [];
    const aiInputs = [];
    const t3 = Date.now();
    for await (let msg of client.fetch(lastUids, { envelope: true, internalDate: true })) {
      const envelope = msg.envelope || {};
      const subject = envelope.subject || '';
      if (isPasswordResetSubject(subject)) continue;
      if (!isWhitelistedSubject(subject, cfg.ai?.subjectWhitelist)) continue;
      const from = (envelope.from || [])
        .map((a) => {
          const name = a.name || '';
          const addr = [a.mailbox, a.host].filter(Boolean).join('@');
          return name ? `${name} <${addr}>` : addr;
        })
        .join(', ');
      const date = msg.internalDate ? new Date(msg.internalDate) : envelope.date ? new Date(envelope.date) : null;
      aiInputs.push({
        uid: msg.uid,
        subject,
        date: date ? date.toISOString() : '',
        from,
      });
      items.push({ uid: msg.uid, subject, from, date: date ? date.toISOString() : null, captcha: null });
    }
    if (cfg.ai?.apiKey) {
      const results = await runWithConcurrency(
        aiInputs.map(({ uid, subject, date }) => ({ uid, subject, date })),
        3,
        (input) => extractCaptchaWithAI(input, cfg.ai),
      );
      const filtered = [];
      results.forEach((raw, idx) => {
        const captcha = normalizeCaptcha(raw);
        if (!captcha) return;
        filtered.push({ ...items[idx], captcha });
      });
      items.length = 0;
      items.push(...filtered);
    } else {
      items.length = 0;
    }
    logPerf(cfg, 'imap.fetch+parse+ai', t3);
    logPerf(cfg, 'imap.total', t0);
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return items;
  } finally {
    try { await client.logout(); } catch (_) {}
  }
}

module.exports = { fetchMessages };
