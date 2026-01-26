// 会话管理（内存存储）：
// - 仅下发浏览器会话标记，前端脚本不可读
// - 同站策略为宽松模式，生产环境走安全通道
// - 简化实现，适合单实例；多实例请替换为共享存储
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

// 设置会话标记，避免被前端脚本读取
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

// 使会话标记立即过期
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

// 中间件：需要有效会话（未配置密钥则跳过）
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
