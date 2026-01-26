// 配置加载与合并（全部来自环境变量）
function loadConfig() {
  // 服务端基础配置
  const server = {
    port: Number(process.env.PORT || process.env.SERVER_PORT || 3001),
  };

  // 邮件连接配置（密码仅从环境读取）
  const imap = {
    host: process.env.IMAP_HOST || null,
    port: Number(process.env.IMAP_PORT || 993),
    tls: (process.env.IMAP_TLS ?? '') !== ''
      ? String(process.env.IMAP_TLS).toLowerCase() !== 'false'
      : true,
    user: process.env.IMAP_USER || null,
    pass: process.env.EMAIL_PASS, // 敏感项
  };

  // 会话配置
  const session = {
    cookieName: process.env.SESSION_COOKIE_NAME || 'mw_sid',
    ttlMs: Number(process.env.SESSION_TTL_MS || 5 * 60 * 1000),
  };

  // 限流配置（按来源地址）
  const rateLimit = {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    api: Number(process.env.RATE_LIMIT_API || 60),
    ssr: Number(process.env.RATE_LIMIT_SSR || 30),
  };

  // 敏感项
  const secrets = {
    accessKey: (process.env.FRONTEND_KEY || '').toString().trim(),
  };

  // 模型配置（仅环境变量）
  const ai = {
    baseUrl: process.env.AI_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'deepseek-chat',
    prompt: process.env.AI_PROMPT || '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 15_000),
    log: String(process.env.AI_LOG || '').toLowerCase() === 'true',
    maxTokens: Number(process.env.AI_MAX_TOKENS || 128),
    payloadMax: Number(process.env.AI_PAYLOAD_MAX || 2000),
    disableCache: String(process.env.AI_DISABLE_CACHE || '').toLowerCase() === 'true',
    subjectWhitelist: String(process.env.AI_SUBJECT_WHITELIST || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };

  const log = {
    perf: String(process.env.PERF_LOG || '').toLowerCase() === 'true',
  };

  return { server, imap, session, rateLimit, secrets, ai, log };
}

module.exports = { loadConfig };
