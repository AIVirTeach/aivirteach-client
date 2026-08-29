# AIVirTeach 桌面端操作手册

本文对应第一版 `Tauri + 当前 React Workspace + Guacamole`。它是一套可运行的桌面壳方案，不引入 IronRDP，也不会在客户端直连 VM 的 3389 端口。

## 1. 最终链路

```text
AIVirTeach Tauri WebView
  └─ https://learn.example.com/        已部署的完整 React/Vinext 应用
      ├─ Server /api/v1                登录、课程、Agent、Lab session
      └─ /guacamole/?data=...          同源 HTTPS/WSS 反向代理
           └─ Guacamole Web :8080
               └─ guacd :4822
                   └─ VM :3389
```

开发时，Tauri 改为加载 `http://localhost:3001`。Vite 已把同源 `/guacamole` 的 HTTP 和 WebSocket 请求代理到 `GUACAMOLE_PROXY_TARGET`。

选择远程托管网页而不是把 `dist/client` 塞进 App，是因为当前项目使用 Vinext App Router、RSC 和 Worker 输出，`dist/client` 没有可独立运行的 `index.html`。如果以后需要完全离线安装包，需要先将前端改成静态 SPA，或将 Node/Vinext 运行时作为 sidecar 单独设计；这不是第一版的构建方式。

## 2. 代码边界

- `src-tauri/`：Tauri/Rust 桌面壳。窗口只允许导航到构建时指定的同一 Origin，并拒绝 `window.open` 新窗口。
- `scripts/create-desktop-config.mjs`：从环境变量生成不提交 Git 的 Tauri production override；只接受 HTTPS，拒绝凭据、query 和 fragment。
- `desktop-placeholder/`：没有通过标准脚本构建时显示的安全占位页。
- `app/workspace/page.tsx`：继续使用现有 Lab session API 和 Guacamole iframe。
- `app/lib/lab-session.ts`：只接受 `/guacamole/?data=<opaque-ticket>` 合约，防止后端响应把 iframe 指向其他站点。

桌面壳没有 shell、文件系统、进程、HTTP 或 opener 插件，也没有给远程网页配置 Tauri capability。它只承载网页。`LABS_SESSION_TOKEN`、Guacamole JSON secret、Cloudflare Service Token 和 VM 凭据都只能存在于服务端。

## 3. 构建机前置依赖

Node.js 版本必须满足仓库的 `>=22.13.0`。另外安装 Rust stable 和目标平台的 Tauri 依赖。

Ubuntu/Debian：

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
```

Windows 使用 Rust MSVC toolchain、Microsoft C++ Build Tools 和 WebView2。Windows 安装包应在 Windows 主机或 Windows CI runner 上生成。macOS 安装 Xcode Command Line Tools 和 Rust，并在 macOS 上生成 `.app`/`.dmg`。不要把一台平台生成的包当成另外平台的原生安装包。

确认环境：

```bash
npm install
npm run desktop:doctor
```

## 4. 本地端到端启动

需要三个终端，顺序是 Labs → Server → Client/Tauri。

### 4.1 Labs：VM Manager + Guacamole

```bash
cd /home/arclab/Desktop/aivirteach/aivirteach-labs/vm-manager/guacamole
cp .env.example .env
chmod 600 .env

openssl rand -hex 16   # 写入 GUACAMOLE_JSON_SECRET
openssl rand -hex 32   # 写入 AIVIRTEACH_SESSION_TOKEN

docker compose up -d --build
docker compose ps
curl -f http://127.0.0.1:8760/health
curl -fL http://127.0.0.1:8080/guacamole/
```

`.env` 不得提交 Git。`AIVIRTEACH_SESSION_TOKEN` 要与 Server 的 `LABS_SESSION_TOKEN` 完全相同。8760 和 8080 目前都只绑定 loopback；guacd 4822 不发布到宿主机。

### 4.2 Server

在 `aivirteach-server/.env` 至少配置：

```dotenv
LEARNER_LAB_MAP='{"learner_advanced":"lab-001"}'
LABS_API_BASE_URL=http://127.0.0.1:8760
LABS_SESSION_TOKEN=与_Labs_AIVIRTEACH_SESSION_TOKEN_相同
GUACAMOLE_PUBLIC_PATH=/guacamole/
```

然后启动：

```bash
cd /home/arclab/Desktop/aivirteach/aivirteach-server
npm install
npm run start:dev
curl -f http://127.0.0.1:4000/api/v1/health
```

当前 `local-demo` Server 使用可伪造的 `X-Demo-User-Id`，只能做本机演示。公开发布桌面 App 之前，必须把这个 Lab session API 放到真实 JWT guard 后面，并从当前登录用户拥有的 Enrollment/Workspace 解析 Lab，不能接受客户端指定的 `lab_id`。

### 4.3 Client + Tauri

`aivirteach-client/.env.local`：

```dotenv
NEXT_PUBLIC_BACKEND_MODE=local
NEXT_PUBLIC_LOCAL_API_BASE_URL=http://localhost:4000/api/v1
GUACAMOLE_PROXY_TARGET=http://127.0.0.1:8080
NEXT_PUBLIC_GUACAMOLE_PUBLIC_PATH=/guacamole/
```

启动桌面开发窗口；该命令会自动启动 3001 的 Vinext dev server：

```bash
cd /home/arclab/Desktop/aivirteach/aivirteach-client
npm install
npm run desktop:dev
```

先在普通浏览器访问 `http://localhost:3001/workspace` 验证，再看 Tauri 窗口。这样能快速区分网页/服务问题和桌面 WebView 问题。

## 5. 生产同源代理

`AIVIRTEACH_DESKTOP_APP_URL` 指向的站点必须同时提供完整 React 应用和 `/guacamole/`。不能让 iframe 直接使用 `http://labs-host:8080`，也不要公开 8760、4822 或 VM 3389。

如果不用默认路径，Client 的 `NEXT_PUBLIC_GUACAMOLE_PUBLIC_PATH`、Server 的 `GUACAMOLE_PUBLIC_PATH` 和公网反向代理三处必须完全一致；该值只能是类似 `/remote-lab/` 的同源绝对 path。开发期 Vite 会把它重写到 Guacamole 内部的 `/guacamole` context。

如果 API 使用另一个 hostname，当前 `local-demo` Server 的 `FRONTEND_ORIGIN` 要精确设置成这个已部署前端 Origin（例如 `https://learn.example.com`）。本方案的 production WebView 本身就是该 HTTPS 页面，不要为了它额外放开 `tauri://localhost`，更不要使用 `*`；若以后改成真正的本地静态 App，再单独设计桌面 Origin 与绝对 Guacamole URL。

Nginx 示例（`map` 放在 `http` 块，`location` 放在对应 HTTPS `server` 块）：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

location /guacamole/ {
    proxy_pass http://127.0.0.1:8080/guacamole/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

上面的 `127.0.0.1:8080` 只在 Nginx 与 Guacamole 位于同一台 Labs 主机时成立。若 React 部署在 Vercel、Cloudflare Pages 或另一台服务器，那个运行环境的 loopback 不是 Labs：必须用 Cloudflare Tunnel/path router、私网 gateway，或在 Labs 同机的边缘反代承接 `/guacamole/`，再让公开 React Origin 把该 path 安全地路由过去。

如果通过 Cloudflare Tunnel，对外 hostname 应先落到这一个同源反向代理，由它按 path 分发 React 与 Guacamole。Cloudflare 和源站都要保留 WebSocket Upgrade。不要给 Guacamole 响应添加 `X-Frame-Options: DENY` 或 `frame-ancestors 'none'`；应该用只允许 AIVirTeach 站点的精确 `frame-ancestors` 策略。

外部验证：

```bash
curl -fI https://learn.example.com/
curl -fL -o /dev/null -w '%{http_code}\n' https://learn.example.com/guacamole/
```

真正进入 Workspace 后，在开发者工具 Network 中确认 Guacamole tunnel 请求成功升级为 WebSocket（HTTP 101）。只看到登录 HTML 的 200 不代表 WebSocket 已配置正确。

## 6. 生成桌面安装包

先部署并验证网页 Origin，再构建桌面壳：

```bash
cd /home/arclab/Desktop/aivirteach/aivirteach-client
export AIVIRTEACH_DESKTOP_APP_URL=https://learn.example.com/
unset AIVIRTEACH_DESKTOP_ALLOW_HTTP_LOCALHOST

npm run desktop:config
npm run desktop:build
```

PowerShell：

```powershell
$env:AIVIRTEACH_DESKTOP_APP_URL = "https://learn.example.com/"
Remove-Item Env:AIVIRTEACH_DESKTOP_ALLOW_HTTP_LOCALHOST -ErrorAction SilentlyContinue
npm run desktop:build
```

生成的 `src-tauri/tauri.generated.conf.json` 已被 Git 忽略。它只应包含公开网页 URL，不得把 token 放在 URL 的 query、fragment 或 userinfo；生成脚本会拒绝这些形式。安装包通常位于 `src-tauri/target/release/bundle/`。

第一次在完整 Rust/Tauri 环境成功构建时会生成 `src-tauri/Cargo.lock`。桌面应用应把这个 lockfile 提交到版本控制并在 CI 使用锁定依赖；当前主机尚未安装 Rust，因此本次不能代为生成可信 lockfile。

仅用于在本机验证 release 壳：

```bash
export AIVIRTEACH_DESKTOP_APP_URL=http://localhost:3001/
export AIVIRTEACH_DESKTOP_ALLOW_HTTP_LOCALHOST=1
npm run desktop:build -- --debug
```

禁止分发这种 HTTP localhost 构建。正式发行还需要为 Windows/macOS 安装包配置代码签名；当前提交没有创建签名私钥，也没有启用自动更新器。

## 7. 验证清单

- [ ] `npm test` 和 `npm run lint` 通过。
- [ ] `npm audit --omit=dev` 没有未处置的 high/critical 生产依赖漏洞。
- [ ] `npm run desktop:doctor` 能看到 Rust、Tauri CLI 和平台 WebView 依赖。
- [ ] 普通浏览器中登录、课程、Agent chat 和 Learning VM 都正常。
- [ ] `POST /api/v1/me/lab/session` 先返回 `starting`，之后返回 `ready`；响应是 `private, no-store`。
- [ ] Client 只接受 `/guacamole/?data=...`，不把完整 ticket 写进日志或截图。
- [ ] Tauri 登录态正常，Workspace 能显示 VM，键盘和鼠标输入有效。
- [ ] 外部导航不会替换主窗口，远程网页无法调用 Tauri shell/fs/process API。
- [ ] 安装包中搜索不到 Labs、Guacamole、Cloudflare 的服务端 secret。
- [ ] 公开环境已替换 demo header 为真实鉴权，并做 session 签发限流与审计。

## 8. 常见故障

| 现象 | 优先检查 |
| --- | --- |
| `desktop:config` 失败 | 是否 export 了完整 HTTPS URL；不能带账号密码、`?query` 或 `#fragment`。 |
| `desktop:dev` 找不到 Cargo/WebKit | 重新执行第 3 节的 Rust 和平台依赖安装；`npm install` 只安装 Tauri CLI，不会安装系统 WebView 开发库。 |
| App 白屏，但浏览器正常 | TLS 证书、WebView 版本、站点 CSP；确认构建时的 URL 是实际站点而非示例域名。 |
| 登录循环或 API CORS | 确认 App 加载的是 HTTPS 托管站点，而不是 `tauri://localhost`；核对远程 API 的 CORS 和 cookie/JWT 配置。 |
| `Learning VM unavailable` | `LEARNER_LAB_MAP`、8760 health、Server/Labs session token 是否一致、VM 是否能启动。 |
| Guacamole 登录页出现但 VM 黑屏 | 检查 guacd 日志、VM IP、xrdp 服务和 3389；登录页可达不等于 RDP 可达。 |
| 画面静止或一段时间后断开 | 先检查 `/guacamole/websocket-tunnel` 是否为 101、反代 timeout/buffering、Cloudflare WebSocket、guacd 与 xrdp 日志。Tauri 的 background-throttling 设置在 Linux/Windows WebView 上没有一致保证，不能替代服务端 keepalive 和 tunnel 排障。 |
| iframe 被拒绝 | 查 Guacamole/反代响应的 `X-Frame-Options` 和 CSP `frame-ancestors`。 |

Tauri 只是应用容器，不会修复 VM 内 xrdp 未监听、网络 ACL、Guacamole 到 3389 不通等服务端问题。排障顺序始终是：VM/xrdp → guacd → Guacamole WebSocket → 同源代理 → 浏览器 → Tauri。

## 9. 发布前安全门槛

1. Server 使用真实 JWT/Workspace 所有权校验，移除公开环境的 demo identity。
2. 轮换任何曾进入 Git、日志或聊天记录的 service token；删除文件不等于清除 Git 历史。
3. Labs browser-session API 和 guacd 保持私网/loopback；公网只暴露 HTTPS 同源入口。
4. Ticket TTL 保持短、响应 `no-store`、日志过滤 `?data=`。
5. 精确限制前端 Origin、Tauri 导航 Origin 和 Guacamole `frame-ancestors`。
6. 在对应 OS 的受控 runner 构建并签名安装包，保留 SBOM/依赖审计结果。
7. 当前壳会拒绝跨 Origin 导航和所有 `window.open`。现有站内账号密码登录可用；若以后采用 Google/Auth0/OIDC，先设计“系统浏览器 + 受控回调/deep link”，不要直接放宽为任意导航。
8. 这个版本加载远程托管前端，因此前端发布会立即改变桌面 App 展示的代码；应保护部署账号、保留可回滚版本，并对前端产物实行与桌面安装包相同等级的发布审批。
