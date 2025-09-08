FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY index.html ./
COPY vite.config.js ./
COPY src ./src

ENV VITE_BACKEND_PROXY=http://backend:3001

EXPOSE 3000

CMD ["npm", "start"]

