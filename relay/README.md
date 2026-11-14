# Cloudflare 中转服务（WebSocket Relay）

线上联机默认走 **WebSocket 中转**，彻底绕开 WebRTC 打洞失败（严格 NAT / 4G / 5G 无法直连）的问题。
玩家只访问 `https://shattered-ops.pages.dev/`，中转与游戏同域（`/ws`），不暴露 workers.dev 域名。

## 架构

```
玩家 A (浏览器) ──wss──┐
                      ├─> shattered-ops.pages.dev/ws   (Pages Function, _worker.js)
玩家 B (浏览器) ──wss──┘            │
                                    └─ Durable Object 绑定 RELAY
                                       (Worker: shattered-ops-relay / class: RelayRoom)
```

- 静态游戏资源：`cf_pages_deploy/`（Pages 直接托管）
- `/api/health`：Pages Function -> Durable Object，返回 `{ok:true, rooms:n, mode:"ws-relay-worker"}`
- `/ws`：Pages Function -> Durable Object，玩家配对后原样转发游戏数据包
  （`{"t":"s"...}` 世界快照 / `{"t":"i"...}` 输入 / `{"t":"p"/"o"}` 延迟探测 / `{"t":"c"...}` 快捷喊话）
- 客户端 `js/netplay.js` 的 `detectBestTransport()` 探测 `/api/health` 成功即使用 `ws` 模式；
  探测失败则回落到 WebRTC P2P。
- `serialization` 等 PeerJS 的 P2P 路径仍保留可用（传输模式选 "Cloud WebRTC P2P Direct"），
  但严格 NAT 下可能连不上，跨网络联机建议用 Auto（= WebSocket 中转）。

## 部署

依赖 Cloudflare 账号（本项目为 Pages 项目 `shattered-ops`）。

```bash
# 0) 安装/使用 wrangler（recordings/contra_export 里已有 node_modules）
cd recordings/contra_export

# 1) 部署 Durable Object Worker（类 RelayRoom，见 relay/src/index.js）
cd ../../relay
npx wrangler deploy

# 2) 部署 Pages（静态资源 + _worker.js Function + DO 绑定）
cd ../recordings/contra_export
npx wrangler pages deploy --project-name shattered-ops --branch main
```

Pages 的绑定配置在本目录的 `wrangler.toml`（`pages_build_output_dir = "cf_pages_deploy"`）：

```toml
[[durable_objects.bindings]]
name = "RELAY"
class_name = "RelayRoom"
script_name = "shattered-ops-relay"
```

`cf_pages_deploy/_worker.js` 由本仓库的 `relay/pages-worker.js` 复制而来；
修改中转逻辑时改 `relay/src/index.js` / `relay/pages-worker.js`，再按上面的顺序重新部署。

## 本地验证方式

```bash
# 健康检查（同时验证 Pages Function -> DO 绑定是否正常）
curl https://shattered-ops.pages.dev/api/health

# 房间数 & 诊断计数（conns/msgs/creates/joins/closed/sends）
curl https://shattered-ops.pages.dev/api/health | jq .stats
```

## 免费额度提示

Durable Objects 在 Workers Free 计划可用（本项目用 SQLite 后端，`new_sqlite_classes`）。
每个 WebSocket 消息都会计一次 DO 请求，一局双人联机约 60 条/秒。
免费额度用完后中转会失败（客户端可切到 P2P 或升级 Workers Paid，$5/月）。
