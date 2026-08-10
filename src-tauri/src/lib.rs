use ironrdp::client::config::{ConfigBuilder, Destination};
use ironrdp::client::rdp::{RdpClient, RdpInputEvent, RdpOutputEvent};
use ironrdp::input::{Database, MouseButton, MousePosition, Operation, Scancode, WheelRotations};
use keyring::v1::Entry;
use serde::{Deserialize, Serialize};
use std::{
    io,
    net::{SocketAddr, TcpListener, TcpStream},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex, RwLock},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::ipc::Response;
use tokio::sync::mpsc;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RdpRequest {
    bastion_host: String,
    bastion_user: String,
    target_host: String,
    target_port: u16,
    rdp_username: String,
    rdp_password: String,
    rdp_domain: String,
    remember_password: bool,
    width: u16,
    height: u16,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InputRequest {
    kind: String,
    x: Option<u16>,
    y: Option<u16>,
    button: Option<u8>,
    scancode: Option<u16>,
    pressed: Option<bool>,
    delta: Option<i16>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionStatus {
    phase: String,
    message: String,
    local_port: Option<u16>,
    started_at: Option<u64>,
    frame_sequence: u64,
    frame_width: u16,
    frame_height: u16,
}

impl ConnectionStatus {
    fn idle(message: impl Into<String>) -> Self {
        Self {
            phase: "idle".into(),
            message: message.into(),
            local_port: None,
            started_at: None,
            frame_sequence: 0,
            frame_width: 0,
            frame_height: 0,
        }
    }
}

#[derive(Default)]
struct FrameBuffer {
    sequence: u64,
    width: u16,
    height: u16,
    rgba: Vec<u8>,
}

struct ConnectionRuntime {
    generation: u64,
    tunnel: Option<Child>,
    input_sender: Option<mpsc::UnboundedSender<RdpInputEvent>>,
    input_database: Database,
    status: ConnectionStatus,
}

impl Default for ConnectionRuntime {
    fn default() -> Self {
        Self {
            generation: 0,
            tunnel: None,
            input_sender: None,
            input_database: Database::new(),
            status: ConnectionStatus::idle("等待连接"),
        }
    }
}

struct RdpManager {
    runtime: Mutex<ConnectionRuntime>,
    frame: RwLock<FrameBuffer>,
}

impl RdpManager {
    fn new() -> Self {
        Self {
            runtime: Mutex::new(ConnectionRuntime::default()),
            frame: RwLock::new(FrameBuffer::default()),
        }
    }

    fn start(self: &Arc<Self>, mut request: RdpRequest) -> Result<ConnectionStatus, String> {
        if request.rdp_username.is_empty() {
            request.rdp_username = std::env::var("AIVIRTEACH_RDP_USERNAME").unwrap_or_default();
        }
        if request.rdp_password.is_empty() {
            request.rdp_password = std::env::var("AIVIRTEACH_RDP_PASSWORD").unwrap_or_default();
        }
        if request.rdp_password.is_empty() {
            request.rdp_password = load_saved_password(&request).unwrap_or_default();
        }
        validate_request(&request)?;
        if request.remember_password {
            save_password(&request)?;
        }

        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "连接状态锁已损坏".to_owned())?;
        Self::stop_runtime(&mut runtime);
        runtime.generation = runtime.generation.wrapping_add(1);
        let generation = runtime.generation;
        clear_frame(&self.frame);

        let local_port = find_open_port().map_err(|error| format!("无法分配本地端口：{error}"))?;
        runtime.status = ConnectionStatus {
            phase: "connecting".into(),
            message: "正在建立 SSH 隧道".into(),
            local_port: Some(local_port),
            started_at: None,
            frame_sequence: 0,
            frame_width: request.width,
            frame_height: request.height,
        };

        let mut tunnel = spawn_ssh_tunnel(&request, local_port)?;
        if let Err(error) = wait_for_tunnel(&mut tunnel, local_port) {
            let _ = tunnel.kill();
            let _ = tunnel.wait();
            runtime.status.phase = "error".into();
            runtime.status.message = error.clone();
            return Err(error);
        }

        let config = ConfigBuilder::new()
            .with_destination(Destination::from_parts("127.0.0.1", local_port))
            .with_username(request.rdp_username)
            .with_password(request.rdp_password)
            .with_domain(request.rdp_domain)
            .with_desktop_width(request.width)
            .with_desktop_height(request.height)
            .with_client_build(26000)
            .with_client_dir(r"C:\Windows\System32\mstscax.dll")
            .with_client_name("AIVIRTEACH")
            .with_platform(ironrdp::pdu::rdp::capability_sets::MajorPlatformType::WINDOWS)
            .with_credssp(false)
            .with_tls(true)
            .with_autologon(true)
            .with_codecs(vec![
                "remotefx:on".into(),
                "qoi:on".into(),
                "qoiz:on".into(),
            ])
            .build()
            .map_err(|error| format!("RDP 配置无效：{error:#}"))?;

        let (output_sender, output_receiver) = mpsc::channel(32);
        let client = RdpClient::new(config, output_sender);
        runtime.input_sender = Some(client.input_sender());
        runtime.tunnel = Some(tunnel);
        runtime.status.message = "SSH 隧道已建立，正在协商 xrdp/TLS".into();
        let initial_status = runtime.status.clone();
        drop(runtime);

        let manager = Arc::clone(self);
        thread::Builder::new()
            .name("aivirteach-ironrdp".into())
            .spawn(move || {
                let tokio_runtime = match tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()
                {
                    Ok(runtime) => runtime,
                    Err(error) => {
                        manager.fail(generation, format!("无法启动 RDP 异步运行时：{error}"));
                        return;
                    }
                };
                tokio_runtime.block_on(async move {
                    tokio::join!(
                        client.run(),
                        manager.consume_output(generation, local_port, output_receiver)
                    );
                });
            })
            .map_err(|error| format!("无法启动 RDP 线程：{error}"))?;

        Ok(initial_status)
    }

    async fn consume_output(
        self: Arc<Self>,
        generation: u64,
        local_port: u16,
        mut receiver: mpsc::Receiver<RdpOutputEvent>,
    ) {
        while let Some(event) = receiver.recv().await {
            let current = self
                .runtime
                .lock()
                .map(|runtime| runtime.generation == generation)
                .unwrap_or(false);
            if !current {
                break;
            }

            match event {
                RdpOutputEvent::Image {
                    buffer,
                    width,
                    height,
                } => {
                    let width = width.get();
                    let height = height.get();
                    let sequence = {
                        let Ok(mut frame) = self.frame.write() else {
                            continue;
                        };
                        frame.sequence = frame.sequence.wrapping_add(1);
                        frame.width = width;
                        frame.height = height;
                        frame.rgba.clear();
                        frame.rgba.reserve(buffer.len() * 4);
                        for pixel in buffer {
                            frame.rgba.extend_from_slice(&[
                                ((pixel >> 16) & 0xff) as u8,
                                ((pixel >> 8) & 0xff) as u8,
                                (pixel & 0xff) as u8,
                                0xff,
                            ]);
                        }
                        frame.sequence
                    };
                    self.update_status(generation, |status| {
                        status.phase = "connected".into();
                        status.message = "正在显示真实远程桌面".into();
                        status.local_port = Some(local_port);
                        if status.started_at.is_none() {
                            status.started_at = unix_timestamp();
                        }
                        status.frame_sequence = sequence;
                        status.frame_width = width;
                        status.frame_height = height;
                    });
                }
                RdpOutputEvent::ConnectionFailure(error) => {
                    self.fail(generation, format!("RDP 连接失败：{}", error));
                    break;
                }
                RdpOutputEvent::Terminated(result) => {
                    let message = match result {
                        Ok(reason) => format!("RDP 会话已结束：{reason}"),
                        Err(error) => format!("RDP 会话异常：{error}"),
                    };
                    self.fail(generation, message);
                    break;
                }
                RdpOutputEvent::PointerDefault
                | RdpOutputEvent::PointerHidden
                | RdpOutputEvent::PointerPosition { .. }
                | RdpOutputEvent::PointerBitmap(_) => {}
            }
        }
    }

    fn update_status(&self, generation: u64, update: impl FnOnce(&mut ConnectionStatus)) {
        if let Ok(mut runtime) = self.runtime.lock() {
            if runtime.generation == generation {
                update(&mut runtime.status);
            }
        }
    }

    fn fail(&self, generation: u64, message: String) {
        if let Ok(mut runtime) = self.runtime.lock() {
            if runtime.generation == generation {
                if let Some(mut tunnel) = runtime.tunnel.take() {
                    let _ = tunnel.kill();
                    let _ = tunnel.wait();
                }
                runtime.input_sender = None;
                runtime.status.phase = "error".into();
                runtime.status.message = message;
            }
        }
    }

    fn status(&self) -> Result<ConnectionStatus, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "连接状态锁已损坏".to_owned())?;
        if let Some(tunnel) = runtime.tunnel.as_mut() {
            if tunnel.try_wait().ok().flatten().is_some() {
                runtime.tunnel = None;
                runtime.input_sender = None;
                runtime.status.phase = "error".into();
                runtime.status.message = "SSH 隧道已意外退出".into();
            }
        }
        Ok(runtime.status.clone())
    }

    fn frame(&self, after_sequence: u64) -> Vec<u8> {
        let Ok(frame) = self.frame.read() else {
            return Vec::new();
        };
        if frame.sequence == 0 || frame.sequence <= after_sequence {
            return Vec::new();
        }
        let mut packet = Vec::with_capacity(12 + frame.rgba.len());
        packet.extend_from_slice(&frame.sequence.to_le_bytes());
        packet.extend_from_slice(&frame.width.to_le_bytes());
        packet.extend_from_slice(&frame.height.to_le_bytes());
        packet.extend_from_slice(&frame.rgba);
        packet
    }

    fn input(&self, request: InputRequest) -> Result<(), String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "连接状态锁已损坏".to_owned())?;
        let sender = runtime
            .input_sender
            .clone()
            .ok_or_else(|| "RDP 尚未连接".to_owned())?;
        let operation = match request.kind.as_str() {
            "mouseMove" => Operation::MouseMove(MousePosition {
                x: request.x.ok_or_else(|| "缺少 x".to_owned())?,
                y: request.y.ok_or_else(|| "缺少 y".to_owned())?,
            }),
            "mouseButton" => {
                let button = MouseButton::from_web_button(
                    request.button.ok_or_else(|| "缺少 button".to_owned())?,
                )
                .ok_or_else(|| "不支持的鼠标按键".to_owned())?;
                if request.pressed.unwrap_or(false) {
                    Operation::MouseButtonPressed(button)
                } else {
                    Operation::MouseButtonReleased(button)
                }
            }
            "wheel" => Operation::WheelRotations(WheelRotations {
                is_vertical: true,
                rotation_units: request.delta.unwrap_or(0),
            }),
            "key" => {
                let scancode =
                    Scancode::from_u16(request.scancode.ok_or_else(|| "缺少 scancode".to_owned())?);
                if request.pressed.unwrap_or(false) {
                    Operation::KeyPressed(scancode)
                } else {
                    Operation::KeyReleased(scancode)
                }
            }
            _ => return Err("未知输入事件".into()),
        };
        let events = runtime.input_database.apply([operation]);
        if !events.is_empty() {
            sender
                .send(RdpInputEvent::FastPath(events))
                .map_err(|_| "RDP 输入通道已关闭".to_owned())?;
        }
        Ok(())
    }

    fn resize(&self, width: u16, height: u16) -> Result<(), String> {
        let runtime = self
            .runtime
            .lock()
            .map_err(|_| "连接状态锁已损坏".to_owned())?;
        let sender = runtime
            .input_sender
            .as_ref()
            .ok_or_else(|| "RDP 尚未连接".to_owned())?;
        sender
            .send(RdpInputEvent::Resize {
                width,
                height,
                scale_factor: 100,
                physical_size: None,
            })
            .map_err(|_| "尺寸更新通道已关闭".to_owned())
    }

    fn disconnect(&self) -> Result<ConnectionStatus, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "连接状态锁已损坏".to_owned())?;
        runtime.generation = runtime.generation.wrapping_add(1);
        Self::stop_runtime(&mut runtime);
        runtime.status = ConnectionStatus::idle("远程会话已断开");
        clear_frame(&self.frame);
        Ok(runtime.status.clone())
    }

    fn stop_runtime(runtime: &mut ConnectionRuntime) {
        if let Some(sender) = runtime.input_sender.take() {
            let _ = sender.send(RdpInputEvent::Close);
        }
        if let Some(mut tunnel) = runtime.tunnel.take() {
            let _ = tunnel.kill();
            let _ = tunnel.wait();
        }
        runtime.input_database = Database::new();
    }
}

impl Drop for RdpManager {
    fn drop(&mut self) {
        if let Ok(runtime) = self.runtime.get_mut() {
            Self::stop_runtime(runtime);
        }
    }
}

fn clear_frame(frame: &RwLock<FrameBuffer>) {
    if let Ok(mut frame) = frame.write() {
        *frame = FrameBuffer::default();
    }
}

fn unix_timestamp() -> Option<u64> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|value| value.as_secs())
}

fn validate_request(request: &RdpRequest) -> Result<(), String> {
    validate_host(&request.bastion_host, "跳板机地址")?;
    validate_host(&request.target_host, "虚拟机地址")?;
    if request.bastion_user.is_empty()
        || !request
            .bastion_user
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || ".-_\\".contains(character))
    {
        return Err("SSH 用户名格式无效".into());
    }
    if request.rdp_username.trim().is_empty() {
        return Err("请输入 Linux 用户名".into());
    }
    if request.rdp_password.is_empty() {
        return Err("请输入 Linux 密码，或设置 AIVIRTEACH_RDP_PASSWORD".into());
    }
    if request.target_port == 0
        || !(640..=7680).contains(&request.width)
        || !(480..=4320).contains(&request.height)
    {
        return Err("RDP 端口或桌面尺寸无效".into());
    }
    Ok(())
}

fn credential_account(request: &RdpRequest) -> String {
    format!(
        "{}@{}:{}",
        request.rdp_username, request.target_host, request.target_port
    )
}

fn credential_entry(request: &RdpRequest) -> Result<Entry, String> {
    Entry::new("AIVirTeach RDP Client", &credential_account(request))
        .map_err(|error| format!("无法访问 Windows 凭据管理器：{error}"))
}

fn load_saved_password(request: &RdpRequest) -> Option<String> {
    credential_entry(request).ok()?.get_password().ok()
}

fn save_password(request: &RdpRequest) -> Result<(), String> {
    credential_entry(request)?
        .set_password(&request.rdp_password)
        .map_err(|error| format!("无法安全保存 RDP 密码：{error}"))
}

pub fn store_credential_from_environment() -> Result<(), String> {
    let request = RdpRequest {
        bastion_host: std::env::var("AIVIRTEACH_BASTION_HOST")
            .unwrap_or_else(|_| "10.162.179.63".into()),
        bastion_user: std::env::var("AIVIRTEACH_BASTION_USER").unwrap_or_else(|_| "arclab".into()),
        target_host: std::env::var("AIVIRTEACH_RDP_HOST")
            .unwrap_or_else(|_| "192.168.122.210".into()),
        target_port: std::env::var("AIVIRTEACH_RDP_PORT")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(3389),
        rdp_username: std::env::var("AIVIRTEACH_RDP_USERNAME").unwrap_or_else(|_| "learner".into()),
        rdp_password: std::env::var("AIVIRTEACH_RDP_PASSWORD")
            .map_err(|_| "缺少 AIVIRTEACH_RDP_PASSWORD".to_owned())?,
        rdp_domain: std::env::var("AIVIRTEACH_RDP_DOMAIN").unwrap_or_default(),
        remember_password: true,
        width: 1280,
        height: 720,
    };
    validate_request(&request)?;
    save_password(&request)
}

pub fn probe_from_environment() -> Result<(), String> {
    let request = RdpRequest {
        bastion_host: std::env::var("AIVIRTEACH_BASTION_HOST")
            .unwrap_or_else(|_| "10.162.179.63".into()),
        bastion_user: std::env::var("AIVIRTEACH_BASTION_USER").unwrap_or_else(|_| "arclab".into()),
        target_host: std::env::var("AIVIRTEACH_RDP_HOST")
            .unwrap_or_else(|_| "192.168.122.210".into()),
        target_port: std::env::var("AIVIRTEACH_RDP_PORT")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(3389),
        rdp_username: std::env::var("AIVIRTEACH_RDP_USERNAME").unwrap_or_else(|_| "learner".into()),
        rdp_password: std::env::var("AIVIRTEACH_RDP_PASSWORD").unwrap_or_default(),
        rdp_domain: std::env::var("AIVIRTEACH_RDP_DOMAIN").unwrap_or_default(),
        remember_password: false,
        width: 1280,
        height: 720,
    };
    let manager = Arc::new(RdpManager::new());
    manager.start(request)?;
    let deadline = Instant::now() + Duration::from_secs(30);
    while Instant::now() < deadline {
        let status = manager.status()?;
        println!(
            "{}: {} (frame {})",
            status.phase, status.message, status.frame_sequence
        );
        if status.phase == "connected" && status.frame_sequence > 0 {
            manager.disconnect()?;
            return Ok(());
        }
        if status.phase == "error" {
            return Err(status.message);
        }
        thread::sleep(Duration::from_millis(500));
    }
    Err("等待首个 xrdp 桌面帧超时".into())
}

fn validate_host(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty()
        || value.starts_with('-')
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || ".-_".contains(character))
    {
        return Err(format!("{label}格式无效"));
    }
    Ok(())
}

fn find_open_port() -> io::Result<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    Ok(listener.local_addr()?.port())
}

fn spawn_ssh_tunnel(request: &RdpRequest, local_port: u16) -> Result<Child, String> {
    let mut command = Command::new("ssh.exe");
    command
        .args([
            "-N",
            "-T",
            "-o",
            "BatchMode=yes",
            "-o",
            "ExitOnForwardFailure=yes",
            "-o",
            "ServerAliveInterval=15",
            "-o",
            "ServerAliveCountMax=3",
            "-o",
            "StrictHostKeyChecking=accept-new",
            "-L",
        ])
        .arg(format!(
            "127.0.0.1:{local_port}:{}:{}",
            request.target_host, request.target_port
        ))
        .arg(format!("{}@{}", request.bastion_user, request.bastion_host))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    hide_console_window(&mut command);
    command
        .spawn()
        .map_err(|error| format!("无法启动 ssh.exe：{error}"))
}

fn wait_for_tunnel(tunnel: &mut Child, local_port: u16) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(12);
    let address = SocketAddr::from(([127, 0, 0, 1], local_port));
    while Instant::now() < deadline {
        if let Ok(Some(status)) = tunnel.try_wait() {
            return Err(format!("SSH 隧道建立失败（退出码 {:?}）", status.code()));
        }
        if TcpStream::connect_timeout(&address, Duration::from_millis(180)).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(120));
    }
    Err("SSH 隧道建立超时".into())
}

#[cfg(target_os = "windows")]
fn hide_console_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x0800_0000);
}

#[cfg(not(target_os = "windows"))]
fn hide_console_window(_command: &mut Command) {}

#[tauri::command]
async fn connect_rdp(
    request: RdpRequest,
    manager: tauri::State<'_, Arc<RdpManager>>,
) -> Result<ConnectionStatus, String> {
    let manager = Arc::clone(manager.inner());
    tauri::async_runtime::spawn_blocking(move || manager.start(request))
        .await
        .map_err(|error| format!("连接任务异常：{error}"))?
}

#[tauri::command]
fn get_connection_status(
    manager: tauri::State<'_, Arc<RdpManager>>,
) -> Result<ConnectionStatus, String> {
    manager.status()
}

#[tauri::command]
fn get_frame(after_sequence: u64, manager: tauri::State<'_, Arc<RdpManager>>) -> Response {
    Response::new(manager.frame(after_sequence))
}

#[tauri::command]
fn send_input(
    request: InputRequest,
    manager: tauri::State<'_, Arc<RdpManager>>,
) -> Result<(), String> {
    manager.input(request)
}

#[tauri::command]
fn resize_rdp(
    width: u16,
    height: u16,
    manager: tauri::State<'_, Arc<RdpManager>>,
) -> Result<(), String> {
    manager.resize(width, height)
}

#[tauri::command]
fn disconnect_rdp(manager: tauri::State<'_, Arc<RdpManager>>) -> Result<ConnectionStatus, String> {
    manager.disconnect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(RdpManager::new()))
        .invoke_handler(tauri::generate_handler![
            connect_rdp,
            get_connection_status,
            get_frame,
            send_input,
            resize_rdp,
            disconnect_rdp
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AIVirTeach RDP client");
}
