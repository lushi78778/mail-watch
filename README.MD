# MailWatch
**项目简介**
- 一个“邮件主题监控”小工具：后端连接 IMAP 邮箱，前端展示最新邮件列表，并支持用正则表达式过滤邮件标题。
- 前端基于 Vite + React + TailwindCSS（shadcn/ui），后端基于 Express + ImapFlow。

**项目地址**
- GitHub: https://github.com/lushi78778/mail-watch

**目录结构**
- `backend/`: Node.js 后端服务（Express + ImapFlow）。
- `frontend/`: React 前端应用（Vite 构建，TailwindCSS 样式）。
- `.env`: 根目录后端环境变量（生产/本地运行时读取）。
- `frontend/.env.local`: 前端本地开发环境变量（Vite 专用）。

**功能特性**
- 正则过滤邮件标题：通过后端的 `EMAIL_TITLE_REGEX` 或请求参数 `regex` 进行筛选。
- 列表展示：显示发件人、主题、时间，支持设置拉取条数（limit）。
- 访问门禁：前端页面需携带 `?key=...` 且值须等于 `VITE_ACCESS_KEY` 才能访问。
- 健康检查与配置查看：`/api/health`、`/api/config`。

**环境准备**
- Node.js 18+（推荐 LTS）。
- 推荐使用 npm 8+/pnpm/yarn 其中一种包管理器（示例以 npm 为主）。

**后端环境变量（根目录 .env）**
- `PORT`: 后端监听端口，默认 `3001`。
- `EMAIL_HOST`: IMAP 主机，例如 `imap.qq.com`、`imap.163.com`、`imap.126.com` 等。
- `EMAIL_PORT`: IMAP 端口，SSL 常用 `993`。
- `EMAIL_USER`: 邮箱账号。
- `EMAIL_PASS`: 邮箱密码或“客户端授权码”。强烈建议使用授权码而非登录密码。
- `EMAIL_TLS`: 是否启用 TLS（`true/false`），默认启用。
- `EMAIL_TITLE_REGEX`: 邮件标题过滤正则（字符串形式）。为空表示不过滤。

示例参见根目录 `/.env.example`（请复制为 `/.env` 并按需修改）。

注意：仓库中的 `/.env` 若含真实凭据，请勿提交到远程仓库；生产环境请通过部署平台的“环境变量/密钥管理”功能注入。

**前端环境变量（frontend/.env.local）**
- `VITE_BACKEND_PROXY`: 前端开发代理目标，例如 `http://localhost:3001`。
- `VITE_ACCESS_KEY`: 前端访问门禁 key。用户访问页面时 URL 必须携带 `?key=此值`。

重要：所有以 `VITE_` 开头的变量会被编译进前端代码，不能视为机密。`VITE_ACCESS_KEY` 仅用于轻量访问门禁，不具备安全性，请按需在网关/反向代理层做更严格的保护。

**本地开发**
1) 安装依赖
- 后端：`cd backend && npm install`
- 前端：`cd frontend && npm install`

2) 配置环境变量
- 根目录复制 `/.env.example` 为 `/.env`，填入实际 IMAP 参数。
- 前端复制 `frontend/.env.example` 为 `frontend/.env.local`，填入 `VITE_BACKEND_PROXY` 与 `VITE_ACCESS_KEY`。

3) 启动服务
- 后端开发：`cd backend && npm run dev`（默认端口 3001）
- 前端开发：`cd frontend && npm run dev`（默认端口 3000）

4) 访问前端
- 浏览器打开：`http://localhost:3000/?key=你的访问key`
- 若不带 `?key=` 或 key 不匹配，将显示 403 提示。

**构建与部署**
- 前端构建：`cd frontend && npm run build`，产物在 `frontend/dist/`。
- 部署前端：将 `dist` 静态文件放到任意静态服务器（Nginx、Vercel 等），并通过反向代理将 `/api` 指向后端。
- 部署后端：`cd backend && npm install && npm run start`（或使用 PM2、Docker 等方式）。

示例 Nginx 反代（片段）：
```
location /api/ {
  proxy_pass http://127.0.0.1:3001/;
}
```

Docker：项目内置 `backend/Dockerfile` 与 `frontend/Dockerfile`，可自行 `docker build` 与 `docker run`。请在部署平台注入 `.env` 中的邮箱配置。

**API 说明（后端）**
- `GET /api/health`：健康检查，返回 `{status: 'ok'}`。
- `GET /api/config`：返回后端关键配置（当前默认正则、IMAP 主机等）。
- `GET /api/messages?limit=50&regex=...`：返回邮件列表。
  - `limit`：最大返回数量，默认 50，最多 500。
  - `regex`：可选，请求级覆盖后端默认正则（字符串）。
  - 响应：`{ total, items: [{ uid, subject, from, date }] }`，`date` 为 ISO 字符串。

**常见问题**
- 403 Forbidden：未在 URL 中带上 `?key=`，或 key 与 `VITE_ACCESS_KEY` 不一致。
- 无法连接 IMAP：检查 `EMAIL_HOST/PORT/USER/PASS`，并确认已为邮箱开启 IMAP 与“客户端授权码”。
- 正则无效或报错：确认 `EMAIL_TITLE_REGEX` 是合法的 JS 正则源字符串（例如 `Error|Warning`）。
- 时区显示：前端使用浏览器 `toLocaleString()`，如需统一时区可在后端归一为固定时区格式。

