# MailWatch

一个只做“登录验证码查看”的邮件工具。

- 首屏 SSR 渲染邮件列表
- 点击后通过 SSE 拉取正文并在列表中展开
- 正文只展示文本（链接文本化，不可点击）
- 访问需要 `?key=...` 会话门禁

## 快速开始

### 本地运行

```bash
npm ci
cp .env.example .env
npm run dev
```

访问：`http://localhost:3001/?key=你的FRONTEND_KEY`

### Docker Compose

```bash
docker compose up -d --build
```

重启：

```bash
docker compose down
docker compose up -d --build
```

## 筛选规则（AND）

邮件会被展示当且仅当同时满足：

1. 发件人域名后缀命中 `MAIL_FROM_DOMAIN_SUFFIX_WHITELIST`
2. 主题命中 `WHITELIST` 任意关键词（例如 `验证码,登录,code,verify`）
3. 主题不是密码重置类（如 `password reset`、`重置密码`、`找回密码`）

## 环境变量

请参考 `.env.example`。核心变量：

- `IMAP_HOST` / `IMAP_PORT` / `IMAP_TLS` / `IMAP_USER` / `EMAIL_PASS`
- `FRONTEND_KEY`
- `WHITELIST`
- `MAIL_FROM_DOMAIN_SUFFIX_WHITELIST`

## 健康检查

- `GET /api/health`
