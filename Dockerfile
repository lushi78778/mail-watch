## 应用镜像构建文件（多阶段构建）

# 1) 构建阶段
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 2) 运行阶段
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY src ./src

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "const http=require('http');http.get('http://127.0.0.1:3001/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

RUN chown -R node:node /app
USER node

CMD ["npm", "start"]
