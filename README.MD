# MailWatch

轻量级邮件验证码查看工具，服务端渲染首屏，支持会话访问控制与 Docker 部署。

## 运行

本地：

```bash
npm ci
cp .env.example .env
npm run dev
```

Docker：

```bash
docker build -t mailwatch .
docker run --rm -p 3001:3001 --env-file .env mailwatch
```

Docker Compose：

```bash
docker compose up -d --build
```

## 必要配置

- `EMAIL_PASS`
- `FRONTEND_KEY`
- `IMAP_HOST`
- `IMAP_USER`
- `AI_API_KEY`

访问：`http://localhost:3001/?key=你的key`
