// 简易内存限流（按来源地址）：
// - 最大次数：时间窗口内允许次数
// - 窗口时长：时间窗口（毫秒）
function createRateLimiter(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let arr = hits.get(ip);
    if (!arr) {
      arr = [];
      hits.set(ip, arr);
    }
    while (arr.length && now - arr[0] > windowMs) arr.shift();
    if (arr.length >= max) {
      const retry = Math.max(0, windowMs - (now - arr[0]));
      res.set('Retry-After', Math.ceil(retry / 1000));
      if (req.path.startsWith('/api/')) {
        return res.status(429).json({ error: 'Too Many Requests' });
      }
      return res.status(429).send('Too Many Requests');
    }
    arr.push(now);
    next();
  };
}

module.exports = { createRateLimiter };
