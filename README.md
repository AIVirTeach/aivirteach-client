# AIVirTeach RDP Client

一个运行在 Windows 上、真正连接 Linux xrdp 的客户端 Demo。Rust 使用 IronRDP 建立会话、解码远程图像并转发键鼠事件；React 只负责把 Rust 收到的 RGBA 像素绘制到 `<canvas>`。界面不会生成或模拟远程桌面。

默认连接路径：

```text
本机 Rust / IronRDP
  -> SSH 隧道 arclab@10.162.179.63
  -> 192.168.122.210:3389
```

旧版纯 HTML Demo 原样保存在 [`legacy-web-demo/`](./legacy-web-demo/) 中，没有删除或覆盖。

## 工作方式

1. Rust 调用 Windows `ssh.exe` 建立只监听 `127.0.0.1` 的临时端口转发。
2. IronRDP 通过该本地端口连接目标 Linux 虚拟机，使用 TLS 图形登录（不使用 Windows NLA/CredSSP）。
3. RDP 服务器返回的真实桌面帧由 Rust 解码，再传给 React Canvas。
4. Canvas 上的键盘、鼠标按键、移动和滚轮事件会发回 RDP 会话。
5. 断开或退出应用时，Rust 关闭 RDP 会话并结束 SSH 隧道。

## 环境要求

- Windows 10/11 与 WebView2 Runtime
- Node.js 20 或更高版本
- Rust stable；推荐安装 Visual Studio C++ Build Tools（MSVC）
- Windows OpenSSH Client（系统中可执行 `ssh.exe`）
- 当前 Windows 用户可通过 SSH key 或 `ssh-agent` 免交互登录跳板机

先验证 SSH：

```powershell
ssh -o BatchMode=yes arclab@10.162.179.63 exit
```

如果命令失败，请先给跳板机配置 SSH 公钥或 Windows `ssh-agent`。客户端不会把 SSH 密码拼进命令行。

## 开发运行

```powershell
npm install
npm run tauri dev
```

首次启动会弹出 Linux 用户名和密码。勾选“安全记住密码”后，密码写入当前 Windows 用户的凭据管理器，下次打开会立即自动连接；也可以在启动前设置：

```powershell
$env:AIVIRTEACH_RDP_USERNAME = "Administrator"
$env:AIVIRTEACH_RDP_PASSWORD = "你的密码"
npm run tauri dev
```

也可在界面中输入凭据。密码不会写入 `localStorage`、源码、日志或临时文件；勾选记住密码时只进入 Windows 凭据管理器。用户名、连接地址和桌面尺寸会保存在 WebView 本地存储中。

只运行 `npm run dev` 是浏览器 UI 预览。浏览器没有 Rust 后端，因此会明确提示无法建立真实 RDP，不会显示模拟桌面。

## 构建

```powershell
npm run build
npm run tauri build
```

目前 `bundle.active` 为 `false`，输出为 Windows 可执行文件，不生成安装包。调试构建位于：

```text
src-tauri/target/debug/aivirteach-client.exe
```

## 默认设置

| 设置 | 默认值 |
| --- | --- |
| SSH 跳板机 | `arclab@10.162.179.63` |
| RDP 目标 | `192.168.122.210:3389` |
| 远程桌面尺寸 | `1280 × 720` |
| 默认账户 | `learner`（域留空） |
| 安全协商 | xrdp TLS + 自动登录 |
| 图形管线 | IronRDP -> RGBA -> React Canvas |
| 输入 | 键盘、鼠标、滚轮 |

真实联机还取决于 Linux 账户、xrdp 服务和桌面会话状态。连接失败时，界面展示的是 SSH 或 RDP 返回的错误，不会回退到假画面。
