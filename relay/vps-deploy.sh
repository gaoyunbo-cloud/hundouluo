#!/usr/bin/env bash
# =============================================================================
# CONTRA: SHATTERED OPS HD - 国内云服务器一键部署脚本
#
# 适用：Ubuntu 20.04/22.04/24.04、Debian 11/12（1 核 1G 足够）
# 作用：安装 Node.js（如缺）→ 用 systemd 常驻运行 server.js（静态站 + WebSocket 中转）
#
# 用法（在云服务器上执行）：
#   1) 先把游戏文件传到服务器，例如：
#        rsync -av --exclude recordings --exclude relay --exclude .git \
#          ./ root@<服务器IP>:/opt/contra/
#      （在本地项目目录执行；只传 index.html、css/、js/、server.js 也行）
#   2) 登录服务器：
#        cd /opt/contra && sudo bash vps-deploy.sh 8888
#
# 部署后玩家直接打开：http://<服务器IP>:8888/
# 端口用非 80 一般无需 ICP 备案；若想用域名 + 80/443，需要域名解析 + 备案。
# =============================================================================
set -euo pipefail

PORT="${1:-${PORT:-8888}}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE="contra-relay"

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 或 sudo 运行：sudo bash $0 $PORT"
  exit 1
fi

if [ ! -f "$APP_DIR/server.js" ] || [ ! -f "$APP_DIR/index.html" ]; then
  echo "错误：当前目录没有 server.js / index.html，请先把游戏文件传到 $APP_DIR"
  exit 1
fi

echo "==> 1/4 检查 Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "    安装 Node.js 20 ..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y ca-certificates curl xz-utils
    # 国内网络优先用 npmmirror 的官方二进制包（快且稳定），失败再尝试 NodeSource
    NODE_VER="v20.18.0"
    NODE_PKG="node-${NODE_VER}-linux-x64.tar.xz"
    if curl -fsSL --max-time 180 -o "/tmp/${NODE_PKG}" "https://npmmirror.com/mirrors/node/${NODE_VER}/${NODE_PKG}"; then
      tar -xJf "/tmp/${NODE_PKG}" -C /usr/local --strip-components=1
    elif curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs; then
      :
    else
      echo "    Node.js 安装失败，请手动安装 Node 18+ 后重跑"
      exit 1
    fi
  else
    echo "    无法自动安装 Node.js，请手动安装 Node 18+ 后重跑"
    exit 1
  fi
fi
node -v

echo "==> 2/4 写入 systemd 服务（$SERVICE，端口 $PORT）"
NODE_BIN="$(command -v node)"
cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=CONTRA: SHATTERED OPS HD - static game + WebSocket relay
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN $APP_DIR/server.js $PORT
Environment=PORT=$PORT
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"
sleep 1
if ! systemctl is-active --quiet "$SERVICE"; then
  echo "服务启动失败，查看日志：journalctl -u $SERVICE -n 50 --no-pager"
  exit 1
fi

echo "==> 3/4 放行防火墙端口 $PORT（如果启用了 ufw/firewalld）"
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "${PORT}/tcp" || true
fi
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="${PORT}/tcp" || true
  firewall-cmd --reload || true
fi
echo "    如果云厂商有安全组/防火墙，请同时放行 TCP ${PORT} 端口"

echo "==> 4/4 自检"
sleep 1
if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "    本机健康检查通过 ✅"
else
  echo "    本机健康检查失败，请查看：journalctl -u $SERVICE -n 50 --no-pager"
fi

IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
echo
echo "=============================================================="
echo " 部署完成！"
echo "   玩家访问： http://${IP}:${PORT}/"
echo "   健康检查： http://${IP}:${PORT}/api/health"
echo "   服务管理： systemctl status ${SERVICE} / journalctl -u ${SERVICE} -f"
echo "=============================================================="
