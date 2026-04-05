# 使用 Node.js 20 作為建構階段
FROM node:20-alpine AS builder

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製源代碼
COPY . .

# 建構應用程式
RUN npm run build

# 使用 Nginx 作為生產環境伺服器
FROM nginx:alpine

# 複製建構產出到 Nginx 目錄
COPY --from=builder /app/dist /usr/share/nginx/html

# 複製 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]
