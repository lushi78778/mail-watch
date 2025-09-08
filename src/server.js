/**
 * 应用入口（Express + Vite SSR + ImapFlow）
 * 职责概览：
 * - 加载配置（config.local.json > config.json）和敏感环境变量（EMAIL_PASS、FRONTEND_KEY）
 * - 会话：通过 /?key=... 首次登录，发放 HttpOnly Cookie（默认 5 分钟有效）
 * - API：/api/messages（需会话）、/api/config（需会话）、/api/health（公开）
 * - SSR：开发注入 Vite 中间件，生产读取 dist 产物渲染
 */
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { loadConfig } = require('./core/config');
const { createRateLimiter } = require('./core/rateLimit');
const { makeSid, setSessionCookie, getSession } = require('./core/session');
const { fetchMessages } = require('./infra/imap');
const { setupSSR } = require('./web/ssr');

// 本地开发时优先加载项目根目录 .env（Docker 下由 env_file 注入）
// 在单体根目录运行时，.env 位于项目根目录（src 的上级）
const rootEnvPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const app = express();
// 在反向代理（如 Nginx、Traefik）后运行时，启用 trust proxy 以获得正确的 req.ip/req.secure
app.set('trust proxy', 1);
// 同源访问，无跨域设置（需跨域可自加中间件）
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 装载配置（文件 + 环境）
const CFG = loadConfig();

// 基本配置（仅 EMAIL_PASS 与 FRONTEND_KEY 来自环境）
const PORT = CFG.server.port;
const ACCESS_KEY = CFG.secrets.accessKey;

// 会话（内存存储）
const SESSION_COOKIE = CFG.session.cookieName;
const SESSION_TTL_MS = CFG.session.ttlMs; // 5min
const sessions = new Map(); // sid -> { createdAt, lastSeen, ip, ua }

// 生产环境必须配置 FRONTEND_KEY，避免误开匿名访问
if (process.env.NODE_ENV === 'production' && !ACCESS_KEY) {
  console.error('[FATAL] FRONTEND_KEY 未配置。为保障安全，生产环境必须设置 FRONTEND_KEY。');
  process.exit(1);
}

// API 会话中间件（未配置 accessKey 时跳过校验）
function requireSession(req, res, next) {
  if (!ACCESS_KEY) return next(); // 未配置 key 则不校验
  const s = getSession(req, sessions, { cookieName: SESSION_COOKIE, ttlMs: SESSION_TTL_MS });
  if (s) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// rate limiter moved to core/rateLimit.js

// 登录仅支持通过 `/?key=...`，成功后发会话 Cookie；不提供其它登录/登出路由。

// IMAP fetch moved to infra/imap.js

// 健康检查（不做门禁）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API 中间件：会话门禁 + 限流
app.use('/api', requireSession, createRateLimiter(CFG.rateLimit.api, CFG.rateLimit.windowMs));

// 返回后端当前关键配置（用于前端展示）
app.get('/api/config', (req, res) => {
  res.json({
    port: PORT,
    titleRegex: CFG.filter.titleRegex || null,
    imap: {
      host: CFG.imap.host || null,
      port: CFG.imap.port || null,
      secure: CFG.imap.tls,
      user: CFG.imap.user ? CFG.imap.user.replace(/(.{2}).+(@.*)/, '$1***$2') : null,
    },
    session: { cookieName: SESSION_COOKIE, ttlMs: SESSION_TTL_MS },
    rateLimit: { windowMs: CFG.rateLimit.windowMs, api: CFG.rateLimit.api, ssr: CFG.rateLimit.ssr },
  });
});

// 拉取邮件列表（默认最多 N 条），并按正则过滤主题
app.get('/api/messages', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const overrideRegex = req.query.regex;
  try {
    const items = await fetchMessages({ limit, overrideRegex }, { imap: CFG.imap, filter: CFG.filter });
    res.json({ total: items.length, items });
  } catch (err) {
    if (err.code === 'CONFIG') {
      return res.status(400).json({ error: err.message });
    }
    console.error('IMAP fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch messages', detail: err.message });
  }
});

async function start() {
  // 初始化 SSR 渲染器（按环境切换）
  const { render } = await setupSSR(app);

  // 定时清理过期会话，避免内存泄漏
  setInterval(() => {
    const now = Date.now();
    for (const [sid, s] of sessions) {
      if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(sid);
    }
  }, Math.min(60_000, Math.max(5_000, Math.floor(SESSION_TTL_MS / 2))));

  // SSR 首页：服务端渲染邮件列表
  // 首页：SSR 渲染
  app.get('/', createRateLimiter(CFG.rateLimit.ssr, CFG.rateLimit.windowMs), async (req, res, next) => {
    try {
      const url = req.originalUrl;
      const urlKey = (req.query.key || '').toString().trim();
      const limit = Math.min(Number(req.query.limit) || 10, 500);
      const overrideRegex = req.query.regex ? String(req.query.regex) : null;
      const hasKeyConfigured = !!ACCESS_KEY;
      const session = getSession(req, sessions, { cookieName: SESSION_COOKIE, ttlMs: SESSION_TTL_MS });
      let allowed = !hasKeyConfigured || !!session;

      // 若带了正确 key，自动建立会话并 302 到去掉 key 的 URL
      if (!session && hasKeyConfigured && urlKey && urlKey === ACCESS_KEY) {
        const sid = makeSid();
        sessions.set(sid, { createdAt: Date.now(), lastSeen: Date.now(), ip: req.ip, ua: req.headers['user-agent'] || '' });
        setSessionCookie(res, sid, req, { cookieName: SESSION_COOKIE, ttlMs: SESSION_TTL_MS });
        const clean = url.replace(/([?&])key=[^&]*(&|$)/, (m, p1, p2) => (p1 === '?' && p2 ? '?' : p1) + (p2 || ''));
        return res.redirect(clean === url ? '/' : clean);
      }

      let items = [];
      let error = null;
      if (allowed) {
        try {
          items = await fetchMessages({ limit, overrideRegex }, { imap: CFG.imap, filter: CFG.filter });
        } catch (err) {
          error = err.code === 'CONFIG' ? err.message : `读取邮件失败：${err.message}`;
        }
      }

      const initialState = {
        allowed,
        hasKeyConfigured,
        limit,
        items,
        error,
        config: {
          titleRegex: CFG.filter.titleRegex || null,
          imap: { host: CFG.imap.host || null, port: CFG.imap.port || null, secure: CFG.imap.tls },
        },
      };

      // 执行SSR并返回完整 HTML
      const html = await render(url, initialState);
      res.status(allowed ? (error ? 500 : 200) : 403).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      next(e);
    }
  });

  app.listen(PORT, () => {
    console.log(`MailWatch backend listening on port ${PORT}`);
  });
}

start();
