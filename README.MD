# MailWatch

一个用于查看收件箱「最新邮件」的轻量级 Web 应用，基于 Express + Vite SSR，支持按邮件标题正则过滤、会话访问控制、Docker 一键部署。

仓库地址：

- https://github.com/lushi78778/mail-watch

## 特性概览

- SSR 首屏渲染，客户端水合，响应快
- 访问控制：首次使用 `/?key=...` 登录，发放 HttpOnly 会话 Cookie
- 安全默认：生产必须配置 `FRONTEND_KEY`，容器内以非 root 运行
- 简易限流：按 IP 内存限流，防刷（单实例）
- IMAP 拉取：基于 ImapFlow，默认限制最近 N 天搜索，提高性能
- 配置分离：非敏感项走 JSON 文件，敏感项只经环境变量注入
- 合规提示：内置 Cookie 同意提示（仅必要会话 Cookie）
- Docker 多阶段构建，内置健康检查 `/api/health`

## 快速开始（Docker）

前置要求：Docker 与 Docker Compose。

1) 配置环境变量（敏感项）

- 复制 `.env.example` 为 `.env`，填写：
  - `EMAIL_PASS`: 邮箱「客户端授权码」或密码（必填）
  - `FRONTEND_KEY`: 首次登录使用的访问密钥（必填，生产强制）

2) 配置非敏感项（可选）

- 编辑 `config.local.json`（或使用镜像内置 `config.json`），至少设置：
  - `imap.host`、`imap.user`（邮箱 IMAP 地址与账号）
  - `filter.titleRegex`（标题正则，可选）
  - `filter.recentDays`（仅搜索最近 N 天，默认 7）

示例：

```json
{
  "server": { "port": 3001 },
  "imap": {
    "host": "imap.example.com",
    "port": 993,
    "tls": true,
    "user": "user@example.com"
  },
  "filter": {
    "titleRegex": "Error|Warning|Alert",
    "recentDays": 7
  },
  "session": { "cookieName": "mw_sid", "ttlMs": 300000 },
  "rateLimit": { "windowMs": 60000, "api": 60, "ssr": 30 }
}
```

3) 启动服务

```bash
docker compose up -d --build
```

默认监听 `3001` 端口：

- 健康检查: `http://localhost:3001/api/health`
- 首次登录（已设置 FRONTEND_KEY）: `http://localhost:3001/?key=你的key`

使用自定义配置文件：在 `docker-compose.yml` 取消注释挂载行：

```yaml
services:
  mailwatch:
    volumes:
      - ./config.local.json:/app/config.local.json:ro
```

## 本地开发（可选）

无需 Docker，直接运行：

```bash
npm ci
npm run dev
```

- 访问地址同生产（默认 `http://localhost:3001`）。
- 开发模式：自动接入 Vite 中间件与 HMR，`.env` 从项目根目录加载。

## 配置说明

敏感项（仅环境变量注入，不写入文件）：

- `EMAIL_PASS`: 邮箱授权码或密码（必填）
- `FRONTEND_KEY`: 访问密钥（必填，生产强制）

非敏感项（`config.json` 或 `config.local.json`）：

- `server.port`: 服务端口（默认 3001）
- `imap.host`/`imap.port`/`imap.tls`/`imap.user`
- `filter.titleRegex`: 标题过滤正则（可选）
- `filter.recentDays`: IMAP 搜索窗口（最近 N 天，默认 7）
- `session.cookieName`/`session.ttlMs`: 会话 Cookie 名与有效期（默认 5 分钟）
- `rateLimit.windowMs`/`rateLimit.api`/`rateLimit.ssr`: 限流参数

加载优先级：`config.local.json` > `config.json`。镜像内置 `config.json` 源自 `config.example.json`。

## API 与路由

- `GET /api/health`: 健康检查（公开）
- `GET /api/config`: 当前关键配置（需会话，若设置了 FRONTEND_KEY）
- `GET /api/messages?limit=50&regex=...`: 最新邮件列表（需会话）
  - `limit`: 返回条数（默认 50，上限 500）
  - `regex`: 临时覆盖标题过滤正则
- `GET /`: SSR 首页（首次通过 `/?key=...` 登录后发放会话 Cookie）

说明：若未设置 `FRONTEND_KEY`（不建议用于生产），API 会话门禁将被跳过。

## 安全与合规

- 生产强制要求设置 `FRONTEND_KEY`，否则服务退出。
- 会话 Cookie 为 `HttpOnly`、`SameSite=Lax`，在 HTTPS 环境自动加 `Secure`（反向代理场景下已启用 `trust proxy`）。
- 容器内以非 root 用户运行。
- 内存限流按 IP 计数，适用于单实例。
- UI 提供 Cookie 同意提示：仅使用必要会话 Cookie（访问控制），不做追踪或广告。


## 故障排查

- 启动即退出：检查是否在生产缺少 `FRONTEND_KEY`。
- `/api/messages` 400：IMAP 配置缺失（需 `imap.host` / `imap.user` 与 `EMAIL_PASS`）。
- 大量邮件超时：增大 `filter.recentDays` 窗口或缩小 `limit`。

---

MailWatch © {2025}. 仅用于学习与研究用途。