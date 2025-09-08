/**
 * 后端服务（Express + ImapFlow）
 * 功能概述：
 * 1) 读取根目录 .env 中的 IMAP 配置，连接邮箱
 * 2) 提供 /api/messages 接口，按正则过滤邮件主题并返回简要列表
 * 3) 提供 /api/config 与 /api/health 辅助接口
 */
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { ImapFlow } = require('imapflow');

// 本地开发时优先加载项目根目录 .env（Docker 下由 env_file 注入）
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const app = express();
app.use(cors());
app.use(express.json());

// 基本配置（详见根目录 .env 与 README）
const PORT = Number(process.env.PORT) || 3001; // 后端端口
const EMAIL_HOST = process.env.EMAIL_HOST; // IMAP 主机
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 993); // IMAP 端口（SSL 常用 993）
const EMAIL_USER = process.env.EMAIL_USER; // 邮箱账号
const EMAIL_PASS = process.env.EMAIL_PASS; // 邮箱密码或授权码
const EMAIL_TLS = (process.env.EMAIL_TLS || 'true').toLowerCase() !== 'false'; // 是否启用 TLS
const DEFAULT_REGEX = process.env.EMAIL_TITLE_REGEX || ''; // 标题过滤正则（字符串）

// 构建正则对象；若非法则忽略并返回 null
function buildRegex(override) {
  const source = override != null && override !== '' ? override : DEFAULT_REGEX;
  if (!source) return null;
  try {
    return new RegExp(source);
  } catch (e) {
    console.error('Invalid EMAIL_TITLE_REGEX:', source, e.message);
    return null;
  }
}

// 创建 IMAP 客户端实例
function createImapClient() {
  return new ImapFlow({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_TLS,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
}

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 返回后端当前关键配置（用于前端展示）
app.get('/api/config', (req, res) => {
  res.json({
    port: PORT,
    titleRegex: DEFAULT_REGEX || null,
    imap: {
      host: EMAIL_HOST || null,
      port: EMAIL_PORT || null,
      secure: EMAIL_TLS,
    },
  });
});

// 拉取邮件列表（默认最多 N 封），并按正则过滤主题
app.get('/api/messages', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const overrideRegex = req.query.regex;
  const regex = buildRegex(overrideRegex);

  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    return res.status(400).json({
      error: 'Missing IMAP configuration. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS.'
    });
  }

  const client = createImapClient();
  try {
    await client.connect();
    // 打开 INBOX
    await client.mailboxOpen('INBOX');

    // 拉取全部 UID，截取最多 N 条
    let uids = await client.search({});
    if (!uids || uids.length === 0) {
      return res.json({ total: 0, items: [] });
    }

    const lastUids = uids.slice(-limit);
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

      const date = msg.internalDate
        ? new Date(msg.internalDate)
        : envelope.date
        ? new Date(envelope.date)
        : null;

      items.push({
        uid: msg.uid,
        subject,
        from,
        date: date ? date.toISOString() : null,
      });
    }

    // 按时间倒序
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    res.json({ total: items.length, items });
  } catch (err) {
    console.error('IMAP fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch messages', detail: err.message });
  } finally {
    try {
      await client.logout();
    } catch (_) {}
  }
});

app.listen(PORT, () => {
  console.log(`MailWatch backend listening on port ${PORT}`);
});

