#!/usr/bin/env bash
# text-2-image-front 前端部署前自检。只读，不修改任何东西。
# 在服务器上、仓库根目录执行：bash deploy/preflight.sh

set -uo pipefail

pass=0; fail=0; warn=0
ok()  { printf '  [ OK ] %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  [FAIL] %s\n' "$1"; fail=$((fail+1)); }
meh() { printf '  [WARN] %s\n' "$1"; warn=$((warn+1)); }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || { echo "无法进入仓库根目录"; exit 1; }
echo "仓库根目录：$ROOT"
echo

echo "== 1. 基础工具 =="
for cmd in docker git; do
    command -v "$cmd" >/dev/null 2>&1 && ok "$cmd 已安装：$("$cmd" --version 2>&1 | head -1)" \
        || bad "$cmd 未安装"
done
docker compose version >/dev/null 2>&1 && ok "docker compose 插件可用" || bad "docker compose v2 不可用"
docker info >/dev/null 2>&1 && ok "Docker 守护进程可访问" || bad "Docker 守护进程不可访问"
echo

echo "== 2. 对外端口 =="
http_port="${PICAGENT_HTTP_PORT:-18081}"
if [ -f .env ]; then
    v="$(grep -E '^[[:space:]]*PICAGENT_HTTP_PORT=' .env 2>/dev/null | tail -n 1 | cut -d= -f2- \
        | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    [ -n "$v" ] && http_port="$v"
fi
if command -v ss >/dev/null 2>&1; then
    occupied="$(ss -ltn 2>/dev/null | awk 'NR>1{print $4}' | sed 's/.*[:.]//' | sort -n -u | tr '\n' ' ')"
    echo "  已占用端口：${occupied:-（读不到）}"
    if printf '%s ' "$occupied" | grep -qw "$http_port"; then
        bad "对外端口 $http_port 已被占用——共用服务器上很可能是别人的服务，换一个"
    else
        ok "对外端口 $http_port 空闲"
    fi
else
    meh "缺少 ss，跳过端口检查"
fi
echo

echo "== 3. 后端可达性 =="
if command -v curl >/dev/null 2>&1; then
    if curl -fsS --noproxy '*' -o /dev/null --max-time 5 "http://127.0.0.1:8000/api/health" 2>/dev/null; then
        ok "后端健康检查通过：http://127.0.0.1:8000/api/health"
    else
        bad "后端不可达（http://127.0.0.1:8000）。本仓库不含后端，请先在服务器上把后端容器起起来"
    fi
    if curl -fsS --noproxy '*' -o /dev/null --max-time 5 "http://127.0.0.1:8000/api/ready" 2>/dev/null; then
        ok "后端依赖就绪（/api/ready）"
    else
        meh "后端 /api/ready 未通过——PG 或 MinIO 可能没连上（这是后端的问题，不是前端的）"
    fi
else
    meh "缺少 curl，跳过后端可达性检查"
fi
echo

echo "== 4. 目录与仓库状态 =="
if git rev-parse --git-dir >/dev/null 2>&1; then
    ok "git 仓库，分支 $(git rev-parse --abbrev-ref HEAD) 提交 $(git rev-parse --short HEAD)"
    remote_url="$(git remote get-url origin 2>/dev/null || true)"
    case "$remote_url" in
        *"@"*github.com*) ok "origin 已带凭据（容器内可 git fetch）" ;;
        "") bad "没有名为 origin 的 remote" ;;
        *) meh "origin 不含访问令牌，容器内 git fetch 可能认证失败：$remote_url" ;;
    esac
else
    bad "当前目录不是 git 仓库"
fi
[ -f deploy/nginx/default.conf ] && ok "nginx 配置存在" || bad "缺少 deploy/nginx/default.conf"
[ -f Dockerfile ] && ok "Dockerfile 存在" || bad "缺少 Dockerfile"
echo

echo "== 5. 构建前置 =="
for img in node:24-slim nginx:1.27-alpine docker:28-cli; do
    docker image inspect "$img" >/dev/null 2>&1 && ok "基础镜像已在本地：$img" \
        || meh "基础镜像缺失：$img —— 先 docker pull $img"
done
if command -v node >/dev/null 2>&1; then
    if node scripts/check-utf8-docs.mjs >/dev/null 2>&1; then
        ok "编码检查通过（prebuild 会跑它）"
    else
        bad "编码检查失败，npm run build 会因此中断。执行 node scripts/check-utf8-docs.mjs 看详情"
    fi
else
    meh "宿主机没有 node，跳过编码检查（容器内仍会跑）"
fi
others="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -v '^text-2-image-front-' | head -20 | tr '\n' ' ')"
[ -n "$others" ] && meh "服务器上还有其他容器，确认端口/网络不冲突：$others" \
    || ok "没有本项目之外的运行中容器"
if [ -n "${DRONE_URL:-}" ]; then
    curl -fsS --noproxy '*' -o /dev/null --max-time 5 "$DRONE_URL/healthz" 2>/dev/null \
        && ok "Drone 可达：$DRONE_URL" || meh "Drone 不可达：$DRONE_URL"
else
    meh "未设置 DRONE_URL，跳过 Drone 可达性检查"
fi
echo

echo "======================================"
printf '通过 %d 项，警告 %d 项，失败 %d 项\n' "$pass" "$warn" "$fail"
[ "$fail" -gt 0 ] && { echo "先处理 FAIL 项再继续部署。"; exit 1; }
echo "没有阻断性问题。"
