FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --only=production

COPY src ./src

EXPOSE 3001

CMD ["npm", "start"]

