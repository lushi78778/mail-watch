/**
 * 应用入口（服务端框架 + 构建工具 + 邮件库）
 * 职责概览：
 * - 加载配置与敏感环境变量（EMAIL_PASS、FRONTEND_KEY）
 * - 会话：通过 /?key=... 首次登录，发放会话标记（默认 5 分钟有效）
 * - 接口：仅保留 /api/health（公开）
 * - 服务端渲染：开发接入构建工具中间件，生产读取构建产物渲染
 */
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { loadConfig } = require('./core/config');
const { createRateLimiter } = require('./core/rateLimit');
const { makeSid, setSessionCookie, getSession, requireSession } = require('./core/session');
const { fetchMessages, fetchMessageSource } = require('./infra/imap');
const { setupSSR } = require('./web/ssr');

// 本地开发时优先加载项目根目录的环境变量文件（容器内由环境变量文件注入）
// 在单体根目录运行时，环境变量文件位于项目根目录
const rootEnvPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const app = express();
// 在反向代理后运行时，启用代理信任以获得正确来源信息
app.set('trust proxy', 1);
// 同源访问，无跨域设置（需跨域可自加中间件）
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 装载配置（文件 + 环境变量）
const CFG = loadConfig();

// 基本配置（敏感项来自环境变量）
const PORT = CFG.server.port;
const ACCESS_KEY = CFG.secrets.accessKey;

// 会话（内存存储）
const SESSION_COOKIE = CFG.session.cookieName;
const SESSION_TTL_MS = CFG.session.ttlMs; // 5 分钟
const sessions = new Map(); // 会话标记 -> { 创建时间, 最近访问, 来源地址, 终端信息 }

// 生产环境必须配置访问密钥，避免误开匿名访问
if (process.env.NODE_ENV === 'production' && !ACCESS_KEY) {
  console.error('[FATAL] FRONTEND_KEY 未配置。为保障安全，生产环境必须设置 FRONTEND_KEY。');
  process.exit(1);
}

// 限流逻辑在独立模块

// 登录仅支持通过链接携带访问参数，成功后发会话标记；不提供其它登录/登出路由。

// 邮件拉取逻辑在独立模块

// 健康检查（唯一保留的接口，不做门禁）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  // 初始化服务端渲染器（按环境切换）
  const { render } = await setupSSR(app);

  // SSE：按 uid 下发单封邮件正文（受会话保护）
  app.get(
    '/stream/message',
    createRateLimiter(CFG.rateLimit.sse, CFG.rateLimit.windowMs),
    requireSession(sessions, CFG.secrets, { cookieName: SESSION_COOKIE, ttlMs: SESSION_TTL_MS }),
    async (req, res) => {
      const sendEvent = (event, payload) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };
      try {
        const uid = Number(req.query.uid);
        if (!Number.isFinite(uid) || uid <= 0) {
          res.status(400);
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          sendEvent('app_error', { error: 'Bad Request' });
          return res.end();
        }

        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        const data = await fetchMessageSource({ uid }, { imap: CFG.imap, mail: CFG.mail, log: CFG.log });
        sendEvent('message', data);
        return res.end();
      } catch (err) {
        const code = err?.code;
        const status =
          code === 'BAD_REQUEST' ? 400
            : code === 'FORBIDDEN' ? 403
              : code === 'NOT_FOUND' ? 404
                : code === 'CONFIG' ? 500
                  : 500;
        if (!res.headersSent) {
          res.status(status);
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
        }
        sendEvent('app_error', { error: status === 500 ? 'Internal Error' : err?.message || 'Request Error' });
        return res.end();
      }
    },
  );

  // 定时清理过期会话，避免内存泄漏
  setInterval(() => {
    const now = Date.now();
    for (const [sid, s] of sessions) {
      if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(sid);
    }
  }, Math.min(60_000, Math.max(5_000, Math.floor(SESSION_TTL_MS / 2))));

  // 首页：服务端渲染邮件列表
  app.get('/', createRateLimiter(CFG.rateLimit.ssr, CFG.rateLimit.windowMs), async (req, res, next) => {
    try {
      const url = req.originalUrl;
      const urlKey = (req.query.key || '').toString().trim();
      const limit = CFG.imap.listLimit;
      const hasKeyConfigured = !!ACCESS_KEY;
      const session = getSession(req, sessions, { cookieName: SESSION_COOKIE, ttlMs: SESSION_TTL_MS });
      let allowed = !hasKeyConfigured || !!session;

      // 若带了正确访问参数，自动建立会话并 302 到去掉参数的链接
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
          items = await fetchMessages({ limit }, { imap: CFG.imap, mail: CFG.mail, log: CFG.log });
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
          imap: { host: CFG.imap.host || null, port: CFG.imap.port || null, secure: CFG.imap.tls },
          filter: {
            fromDomainSuffixWhitelist: CFG.mail.fromDomainSuffixWhitelist,
            subjectWhitelist: CFG.mail.subjectWhitelist,
          },
        },
      };

      // 执行渲染并返回完整页面
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
