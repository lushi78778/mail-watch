## MailWatch 的多阶段构建（Express + Vite SSR）

# 1) 构建阶段：安装依赖并构建客户端与服务端产物
FROM node:20-alpine AS build
WORKDIR /app

# 使用大陆镜像源以加速 apk（如需）
ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine/
RUN sed -i "s|https://dl-cdn.alpinelinux.org/alpine/|${ALPINE_MIRROR}|g" /etc/apk/repositories

# 安装依赖（包含构建所需的开发依赖）
COPY package*.json ./
RUN npm ci

# 复制源码并执行打包
COPY . .
RUN npm run build

# 2) 运行阶段：仅安装生产依赖，最小化镜像体积
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 使用大陆镜像源以加速 apk（如需）
ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine/
RUN sed -i "s|https://dl-cdn.alpinelinux.org/alpine/|${ALPINE_MIRROR}|g" /etc/apk/repositories

# 仅安装生产依赖
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 拷贝构建产物与服务端代码
COPY --from=build /app/dist ./dist
COPY src ./src

# 提供默认配置（可通过挂载覆盖）
COPY config.example.json ./config.json

# 暴露服务端口（可在 config.json 中配置，默认 3001）
EXPOSE 3001

# 健康检查（使用 Node 发起 HTTP 请求，无需额外工具）
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "const http=require('http');http.get('http://127.0.0.1:3001/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# 以非 root 运行
RUN chown -R node:node /app
USER node

# 启动服务
CMD ["npm", "start"]
