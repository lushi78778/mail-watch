// IMAP 基础设施层：负责与邮箱进行交互
const { ImapFlow } = require('imapflow');

// 尝试构造正则；非法则返回 null
function buildRegex(source) {
  if (!source) return null;
  try {
    return new RegExp(String(source));
  } catch {
    return null;
  }
}

// 创建 ImapFlow 客户端实例
function createImapClient({ host, port, tls, user, pass }) {
  return new ImapFlow({ host, port, secure: tls, auth: { user, pass } });
}

// 拉取邮件：按 limit 截取 + 正则过滤主题，按时间倒序
async function fetchMessages({ limit = 50, overrideRegex = null }, cfg) {
  const { host, port, tls, user, pass } = cfg.imap;
  if (!host || !user || !pass) {
    const err = new Error('Missing IMAP configuration. Set host/user/pass.');
    err.code = 'CONFIG';
    throw err;
  }
  const regex = buildRegex(overrideRegex || cfg.filter?.titleRegex);
  const recentDays = Number(cfg.filter?.recentDays || 7);
  const since = Number.isFinite(recentDays) && recentDays > 0
    ? new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000)
    : null;
  const client = createImapClient({ host, port, tls, user, pass });
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    let query = {};
    if (since) query.since = since;
    let uids = await client.search(query);
    if (!uids || uids.length === 0) return [];
    const lastUids = uids.slice(-Math.min(limit, 500));
    const items = [];
    for await (let msg of client.fetch(lastUids, { envelope: true, internalDate: true })) {
      const envelope = msg.envelope || {};
      const subject = envelope.subject || '';
      if (regex && !regex.test(subject)) continue;
      const from = (envelope.from || [])
        .map((a) => {
          const name = a.name || '';
          const addr = [a.mailbox, a.host].filter(Boolean).join('@');
          return name ? `${name} <${addr}>` : addr;
        })
        .join(', ');
      const date = msg.internalDate ? new Date(msg.internalDate) : envelope.date ? new Date(envelope.date) : null;
      items.push({ uid: msg.uid, subject, from, date: date ? date.toISOString() : null });
    }
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return items;
  } finally {
    try { await client.logout(); } catch (_) {}
  }
}

module.exports = { fetchMessages };
