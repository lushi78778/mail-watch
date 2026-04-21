function parseCsvEnv(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// 配置加载与合并（全部来自环境变量）
function loadConfig() {
  const server = {
    port: Number(process.env.PORT || process.env.SERVER_PORT || 3001),
  };

  const imap = {
    host: process.env.IMAP_HOST || null,
    port: Number(process.env.IMAP_PORT || 993),
    tls: (process.env.IMAP_TLS ?? '') !== ''
      ? String(process.env.IMAP_TLS).toLowerCase() !== 'false'
      : true,
    user: process.env.IMAP_USER || null,
    pass: process.env.EMAIL_PASS,
    listLimit: Number(process.env.MAIL_LIST_LIMIT || 20),
    sourceMaxChars: Number(process.env.MAIL_SOURCE_MAX_CHARS || 200_000),
  };

  const session = {
    cookieName: process.env.SESSION_COOKIE_NAME || 'mw_sid',
    ttlMs: Number(process.env.SESSION_TTL_MS || 5 * 60 * 1000),
  };

  const rateLimit = {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    sse: Number(process.env.RATE_LIMIT_SSE || 60),
    ssr: Number(process.env.RATE_LIMIT_SSR || 30),
  };

  const secrets = {
    accessKey: (process.env.FRONTEND_KEY || '').toString().trim(),
  };

  const subjectWhitelist = parseCsvEnv(process.env.WHITELIST);
  const fromDomainSuffixWhitelist = parseCsvEnv(process.env.MAIL_FROM_DOMAIN_SUFFIX_WHITELIST || 'openai.com');

  const mail = {
    subjectWhitelist,
    fromDomainSuffixWhitelist,
  };

  const log = {
    perf: String(process.env.PERF_LOG || '').toLowerCase() === 'true',
  };

  return { server, imap, session, rateLimit, secrets, mail, log };
}

module.exports = { loadConfig };
