# text-2-image-front

PicAgent Studio 的前端（React 19 + Vite）。后端在另一个仓库。

## 项目文档

前后端保持同级目录时，可阅读后端仓库统一维护的项目文档：

- [项目演示稿](../text-2-image/docs/project/project-demo.md)。
- [学习与开发交接](../text-2-image/docs/project/learning-and-handoff.md)。
- [面试与项目讲解](../text-2-image/docs/project/interview-and-presentation.md)。

单独浏览本仓库时，请在后端仓库的 `docs/project/` 查阅。

## 分支合并练习

文档的小改动也可以用来练习完整的分支合并流程：

1. 从 `main` 创建练习分支，修改文档并提交。
2. 将练习分支推送到 GitHub，创建目标为 `main` 的 Pull Request。
3. 检查变更内容后合并，再在本地同步 `main`。

冲突练习版本：创建 PR 后，先阅读文件差异；确认内容符合预期，再手动完成合并。

练习目标：遇到冲突时，检查两个分支在同一位置的不同说明，整理为准确的合并流程。

## 本地运行

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

`vite.config.ts` 只代理 `/api`，默认指向 `http://127.0.0.1:8000`，
可用环境变量 `VITE_FASTAPI_PROXY_TARGET` 覆盖。所以本地要先把后端跑起来。

```bash
npm test          # tsx --test
npm run typecheck
npm run build
npm run test:e2e  # Playwright
```

## 部署

单机 Docker Compose + Drone CI。**先手动跑通，再接 CI。**

```bash
sudo mkdir -p /srv/text-2-image-front
git clone https://<用户名>:<令牌>@github.com/<owner>/text-2-image-front.git /srv/text-2-image-front
cd /srv/text-2-image-front

docker compose -p text-2-image-front build
docker compose -p text-2-image-front up -d
```

对外端口由 `.env` 的 `PICAGENT_HTTP_PORT` 控制，默认 `18081`。

**这个仓库不自带后端。** nginx 经 `host.docker.internal:8000` 反代到
宿主机回环上的后端，所以：

- 后端必须先起（或至少容器在跑），否则前端页面能开、接口全 502
- 后端改了监听端口，要同步改 `deploy/nginx/default.conf` 里的
  `proxy_pass http://host.docker.internal:<端口>`
- nginx 配置在**构建时 COPY 进镜像**（`deploy/nginx/default.conf` → `/etc/nginx/http.d/default.conf`），改了要**重新 build** 才生效，`restart` 不够

## 几条不能破的约定

- `prebuild` 会跑 `scripts/check-utf8-docs.mjs`（编码检查）。
  它默认扫 `openspec/`，本仓库没有这个目录——脚本已容忍缺失目录，
  但如果改了扫描范围，注意别让它扫不存在的路径而抛错，否则构建会挂。
- `.drone.yml` 里两处 `/srv/text-2-image-front` 与目录实际位置要一致。
- 共用服务器上：不要 `docker system prune` / `image prune -a`；
  `docker compose down` 要带 `-p text-2-image-front`。
