// 会话管理（内存存储）：
// - 仅发放 HttpOnly Cookie（SameSite=Lax），生产 HTTPS 自动加 Secure
// - 简化实现，适合单实例；多实例请替换为 Redis 等共享存储
const crypto = require('crypto');

function makeSid() {
  return crypto.randomBytes(32).toString('hex');
}

function getCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((p) => {
    const [k, v] = p.split('=');
    if (k && v) out[k.trim()] = decodeURIComponent(v.trim());
  });
  return out;
}

// 设置会话 Cookie（HttpOnly，避免被 JS 读取）
function setSessionCookie(res, sid, req, { cookieName, ttlMs }) {
  const isProd = process.env.NODE_ENV === 'production';
  const secure = isProd && (req?.secure || req?.headers?.['x-forwarded-proto'] === 'https');
  const attrs = [
    `${cookieName}=${sid}`,
    `HttpOnly`,
    `Path=/`,
    `SameSite=Lax`,
    `Max-Age=${Math.floor(ttlMs / 1000)}`,
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

// 使 Cookie 立即过期
function clearSessionCookie(res, { cookieName }) {
  res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

// 校验并返回会话；若过期则清除
function getSession(req, store, { cookieName, ttlMs }) {
  const cookies = getCookies(req);
  const sid = cookies[cookieName];
  if (!sid) return null;
  const s = store.get(sid);
  if (!s) return null;
  const now = Date.now();
  if (now - s.createdAt > ttlMs) {
    store.delete(sid);
    return null;
  }
  s.lastSeen = now;
  return { sid, ...s };
}

// 中间件：需要有效会话（若未配置 accessKey 则跳过）
function requireSession(store, { accessKey }, opts) {
  return function (req, res, next) {
    if (!accessKey) return next();
    const s = getSession(req, store, opts);
    if (s) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

module.exports = {
  makeSid,
  getCookies,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  requireSession,
};
