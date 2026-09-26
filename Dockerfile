FROM node:24-slim AS build

# 默认走 npmmirror。理由同后端。
ARG NPM_REGISTRY=https://registry.npmmirror.com

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --registry="$NPM_REGISTRY"

# 整仓拷贝：build 会先跑 prebuild 的 check:encoding。
COPY . .
RUN npm run build

FROM nginx:1.27-alpine

# 配置直接 COPY 进镜像，不挂载 —— 挂载依赖宿主机上文件此刻的状态，而且路径写错
# 不会报错，只会让 nginx 起不来。
# 路径必须是 /etc/nginx/http.d/：这个 nginx:1.27-alpine 的 nginx.conf include 的是
# http.d/*.conf（Alpine 打包风格），不是官方镜像的 conf.d/*.conf。
# 放错目录会让 server{} 落到 main 上下文，容器启动即 [emerg] 退出。
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx/default.conf /etc/nginx/http.d/default.conf

EXPOSE 80
