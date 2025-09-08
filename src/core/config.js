// 配置加载与合并（非敏感项从文件读取，敏感项来自环境变量）
const fs = require('fs');
const path = require('path');

// 读取 JSON 配置（容错）
function loadJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) || {};
  } catch (e) {
    console.error('Failed to parse JSON config:', p, e.message);
    return {};
  }
}

// 加载顺序：config.local.json > config.json
function loadConfig() {
  const candidates = [
    path.resolve(process.cwd(), 'config.local.json'),
    path.resolve(process.cwd(), 'config.json'),
  ];
  let cfg = {};
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      cfg = loadJsonSafe(p);
      break;
    }
  }

  // Server 基本配置
  const server = {
    port: Number(cfg.server?.port || 3001),
  };

  // IMAP 连接配置（密码仅从环境读取）
  const imap = {
    host: cfg.imap?.host || null,
    port: Number(cfg.imap?.port || 993),
    tls: cfg.imap?.tls !== false,
    user: cfg.imap?.user || null,
    pass: process.env.EMAIL_PASS, // sensitive
  };

  // 业务过滤配置
  const filter = {
    titleRegex: cfg.filter?.titleRegex || '',
    // 最近 N 天的邮件用于搜索窗口（避免大邮箱全量搜索），默认 7 天
    recentDays: Number(cfg.filter?.recentDays || 7),
  };

  // 会话配置
  const session = {
    cookieName: cfg.session?.cookieName || 'mw_sid',
    ttlMs: Number(cfg.session?.ttlMs || 5 * 60 * 1000),
  };

  // 限流配置（按 IP）
  const rateLimit = {
    windowMs: Number(cfg.rateLimit?.windowMs || 60_000),
    api: Number(cfg.rateLimit?.api || 60),
    ssr: Number(cfg.rateLimit?.ssr || 30),
  };

  // 敏感项
  const secrets = {
    accessKey: (process.env.FRONTEND_KEY || '').toString().trim(),
  };

  return { server, imap, filter, session, rateLimit, secrets };
}

module.exports = { loadConfig };
