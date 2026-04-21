const { ImapFlow } = require('imapflow');

function createImapClient({ host, port, tls, user, pass }) {
  return new ImapFlow({ host, port, secure: tls, auth: { user, pass } });
}

function logPerf(cfg, label, start) {
  if (!cfg?.log?.perf) return;
  const ms = Date.now() - start;
  console.log(`[PERF] ${label} ${ms}ms`);
}

function toIsoDate(dateLike) {
  if (!dateLike) return null;
  const date = new Date(dateLike);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isWhitelistedSubject(subject, whitelist) {
  if (!whitelist || whitelist.length === 0) return true;
  const s = String(subject || '').toLowerCase();
  return whitelist.some((term) => s.includes(String(term).toLowerCase()));
}

function isPasswordResetSubject(subject) {
  const s = String(subject || '');
  return /password\s*reset|reset\s*password|reset\s*code/i.test(s)
    || /密码.*(重置|找回)|重置.*密码|找回.*密码/.test(s);
}

function isAllowedFromDomainSuffix(envelopeFrom, suffixWhitelist) {
  if (!suffixWhitelist || suffixWhitelist.length === 0) return true;
  const hosts = (Array.isArray(envelopeFrom) ? envelopeFrom : [])
    .map((addr) => {
      const directHost = String(addr?.host || '').toLowerCase();
      if (directHost) return directHost;
      const full = String(addr?.address || '').toLowerCase();
      const at = full.lastIndexOf('@');
      return at >= 0 ? full.slice(at + 1) : '';
    })
    .filter(Boolean);
  if (hosts.length === 0) return false;
  return hosts.some((host) =>
    suffixWhitelist.some((suffix) => {
      const s = String(suffix || '').toLowerCase();
      return host === s || host.endsWith(`.${s}`);
    }),
  );
}

function formatFrom(envelopeFrom) {
  return (Array.isArray(envelopeFrom) ? envelopeFrom : [])
    .map((a) => {
      const name = a?.name || '';
      const addr = a?.address || [a?.mailbox, a?.host].filter(Boolean).join('@');
      return name ? `${name} <${addr}>` : addr;
    })
    .filter(Boolean)
    .join(', ');
}

function matchesAndFilter(envelope, cfg) {
  const subject = envelope?.subject || '';
  const passSender = isAllowedFromDomainSuffix(envelope?.from, cfg.mail?.fromDomainSuffixWhitelist);
  const passSubject = isWhitelistedSubject(subject, cfg.mail?.subjectWhitelist);
  const isReset = isPasswordResetSubject(subject);
  return passSender && passSubject && !isReset;
}

function clipSource(source, maxChars) {
  const text = String(source || '');
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[... clipped ...]`;
}

function validateImapConfig(imap) {
  const { host, user, pass } = imap || {};
  if (!host || !user || !pass) {
    const err = new Error('Missing IMAP configuration. Set host/user/pass.');
    err.code = 'CONFIG';
    throw err;
  }
}

// 拉取邮件列表并执行 AND 筛选：发件域名 + 主题白名单
async function fetchMessages({ limit = 20 }, cfg) {
  validateImapConfig(cfg.imap);
  const { host, port, tls, user, pass } = cfg.imap;
  const client = createImapClient({ host, port, tls, user, pass });
  try {
    const t0 = Date.now();
    await client.connect();
    logPerf(cfg, 'imap.connect', t0);

    const t1 = Date.now();
    await client.mailboxOpen('INBOX');
    logPerf(cfg, 'imap.mailboxOpen', t1);

    const t2 = Date.now();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const uids = await client.search({ since });
    logPerf(cfg, 'imap.search', t2);
    if (!uids || uids.length === 0) return [];

    const lastUids = uids.slice(-Math.max(1, Number(limit) || 20));
    const items = [];
    const t3 = Date.now();
    for await (const msg of client.fetch(lastUids, { envelope: true, internalDate: true })) {
      const envelope = msg.envelope || {};
      if (!matchesAndFilter(envelope, cfg)) continue;
      items.push({
        uid: msg.uid,
        subject: envelope.subject || '',
        from: formatFrom(envelope.from),
        date: toIsoDate(msg.internalDate || envelope.date),
      });
    }
    logPerf(cfg, 'imap.fetch+filter', t3);
    logPerf(cfg, 'imap.total', t0);
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return items;
  } finally {
    try { await client.logout(); } catch (_) {}
  }
}

// 按 uid 拉取单封邮件原文（只允许查看命中过滤规则的邮件）
async function fetchMessageSource({ uid }, cfg) {
  validateImapConfig(cfg.imap);
  const numericUid = Number(uid);
  if (!Number.isFinite(numericUid) || numericUid <= 0) {
    const err = new Error('Missing uid.');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const { host, port, tls, user, pass, sourceMaxChars = 200_000 } = cfg.imap;
  const client = createImapClient({ host, port, tls, user, pass });
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    const msg = await client.fetchOne(numericUid, { envelope: true, internalDate: true, source: true }, { uid: true });
    if (!msg) {
      const err = new Error('Message not found.');
      err.code = 'NOT_FOUND';
      throw err;
    }
    const envelope = msg.envelope || {};
    if (!matchesAndFilter(envelope, cfg)) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }
    return {
      uid: numericUid,
      subject: envelope.subject || '',
      from: formatFrom(envelope.from),
      date: toIsoDate(msg.internalDate || envelope.date),
      source: clipSource(msg.source ? msg.source.toString('utf8') : '', sourceMaxChars),
    };
  } finally {
    try { await client.logout(); } catch (_) {}
  }
}

module.exports = { fetchMessages, fetchMessageSource };
