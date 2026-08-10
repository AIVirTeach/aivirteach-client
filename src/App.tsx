import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Phase = "idle" | "connecting" | "connected" | "error";
interface RdpConfig {
  bastionHost: string; bastionUser: string; targetHost: string; targetPort: number;
  rdpUsername: string; rdpDomain: string; rememberPassword: boolean; width: number; height: number;
}
interface ConnectionStatus {
  phase: Phase; message: string; localPort: number | null; startedAt: number | null;
  frameSequence: number; frameWidth: number; frameHeight: number;
}
interface InputRequest {
  kind: "mouseMove" | "mouseButton" | "wheel" | "key";
  x?: number; y?: number; button?: number; scancode?: number; pressed?: boolean; delta?: number;
}

const DEFAULT_CONFIG: RdpConfig = {
  bastionHost: "10.162.179.63", bastionUser: "arclab", targetHost: "192.168.122.210",
  targetPort: 3389, rdpUsername: "learner", rdpDomain: "", rememberPassword: true, width: 1280, height: 720,
};
const IDLE: ConnectionStatus = { phase: "idle", message: "请输入 Linux 凭据以建立真实 xrdp 会话", localPort: null, startedAt: null, frameSequence: 0, frameWidth: 0, frameHeight: 0 };

function loadConfig(): RdpConfig {
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem("aivirteach.rdp.config") || "{}") }; }
  catch { return DEFAULT_CONFIG; }
}
function isTauri() { return Boolean(window.__TAURI_INTERNALS__); }

const SCANCODES: Record<string, number> = {
  Escape:0x01, Digit1:0x02, Digit2:0x03, Digit3:0x04, Digit4:0x05, Digit5:0x06, Digit6:0x07, Digit7:0x08, Digit8:0x09, Digit9:0x0a, Digit0:0x0b,
  Minus:0x0c, Equal:0x0d, Backspace:0x0e, Tab:0x0f, KeyQ:0x10, KeyW:0x11, KeyE:0x12, KeyR:0x13, KeyT:0x14, KeyY:0x15, KeyU:0x16, KeyI:0x17, KeyO:0x18, KeyP:0x19,
  BracketLeft:0x1a, BracketRight:0x1b, Enter:0x1c, ControlLeft:0x1d, KeyA:0x1e, KeyS:0x1f, KeyD:0x20, KeyF:0x21, KeyG:0x22, KeyH:0x23, KeyJ:0x24, KeyK:0x25, KeyL:0x26,
  Semicolon:0x27, Quote:0x28, Backquote:0x29, ShiftLeft:0x2a, Backslash:0x2b, KeyZ:0x2c, KeyX:0x2d, KeyC:0x2e, KeyV:0x2f, KeyB:0x30, KeyN:0x31, KeyM:0x32, Comma:0x33, Period:0x34,
  Slash:0x35, ShiftRight:0x36, NumpadMultiply:0x37, AltLeft:0x38, Space:0x39, CapsLock:0x3a, F1:0x3b, F2:0x3c, F3:0x3d, F4:0x3e, F5:0x3f, F6:0x40, F7:0x41, F8:0x42, F9:0x43, F10:0x44,
  NumLock:0x45, ScrollLock:0x46, Numpad7:0x47, Numpad8:0x48, Numpad9:0x49, NumpadSubtract:0x4a, Numpad4:0x4b, Numpad5:0x4c, Numpad6:0x4d, NumpadAdd:0x4e, Numpad1:0x4f, Numpad2:0x50,
  Numpad3:0x51, Numpad0:0x52, NumpadDecimal:0x53, F11:0x57, F12:0x58, NumpadEnter:0xe01c, ControlRight:0xe01d, NumpadDivide:0xe035, AltRight:0xe038, Home:0xe047, ArrowUp:0xe048,
  PageUp:0xe049, ArrowLeft:0xe04b, ArrowRight:0xe04d, End:0xe04f, ArrowDown:0xe050, PageDown:0xe051, Insert:0xe052, Delete:0xe053, MetaLeft:0xe05b, MetaRight:0xe05c, ContextMenu:0xe05d,
};

function Icon({ type }: { type: "screen" | "server" | "vm" | "shield" }) {
  const p = type === "screen" ? <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></> : type === "server" ? <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h.01M8 12h.01M12 8h4M12 12h4M8 16h8"/></> : type === "vm" ? <><path d="m12 3-8 4v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10"/></> : <><path d="M12 3 5 6v5c0 4.5 2.8 8.5 7 10 4.2-1.5 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-5"/></>;
  return <svg viewBox="0 0 24 24">{p}</svg>;
}

export default function App() {
  const [config, setConfig] = useState(loadConfig);
  const [draft, setDraft] = useState(loadConfig);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>(IDLE);
  const [dialogOpen, setDialogOpen] = useState(!loadConfig().rdpUsername);
  const [elapsed, setElapsed] = useState("00:00:00");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameSequence = useRef(0);
  const polling = useRef(false);
  const connectStarted = useRef(false);
  const mousePending = useRef<{x:number;y:number}|null>(null);
  const mouseRaf = useRef(0);

  const refresh = useCallback(async () => {
    if (!isTauri()) return;
    try { setStatus(await invoke<ConnectionStatus>("get_connection_status")); }
    catch (error) { setStatus({ ...IDLE, phase: "error", message: String(error) }); }
  }, []);

  const connect = useCallback(async (next = draft) => {
    connectStarted.current = true;
    if (!isTauri()) {
      setStatus({ ...IDLE, phase: "error", message: "真实 RDP 只能在 Tauri 客户端中运行，请使用 npm run tauri dev" });
      return;
    }
    localStorage.setItem("aivirteach.rdp.config", JSON.stringify(next));
    setConfig(next); setDialogOpen(false); frameSequence.current = 0;
    setStatus({ ...IDLE, phase: "connecting", message: "Rust 正在建立 SSH 隧道" });
    try { setStatus(await invoke<ConnectionStatus>("connect_rdp", { request: { ...next, rdpPassword: password } })); setPassword(""); }
    catch (error) { setStatus({ ...IDLE, phase: "error", message: String(error) }); setDialogOpen(true); }
  }, [draft, password]);

  const disconnect = useCallback(async () => {
    if (!isTauri()) { setStatus(IDLE); return; }
    try { setStatus(await invoke<ConnectionStatus>("disconnect_rdp")); frameSequence.current = 0; }
    catch (error) { setStatus({ ...IDLE, phase: "error", message: String(error) }); }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 700);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!connectStarted.current && isTauri()) void connect(config);
  }, [config, connect]);

  useEffect(() => {
    if (!status.startedAt) { setElapsed("00:00:00"); return; }
    const update = () => { const n = Math.max(0, Math.floor(Date.now()/1000-status.startedAt!)); setElapsed(`${String(Math.floor(n/3600)).padStart(2,"0")}:${String(Math.floor(n%3600/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`); };
    update(); const timer = window.setInterval(update, 1000); return () => clearInterval(timer);
  }, [status.startedAt]);

  useEffect(() => {
    let stopped = false;
    async function pullFrame() {
      if (stopped || polling.current || status.phase !== "connected" || !isTauri()) return;
      polling.current = true;
      try {
        const raw = await invoke<ArrayBuffer | number[]>("get_frame", { afterSequence: frameSequence.current });
        const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw);
        if (bytes.byteLength >= 12) {
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const sequence = Number(view.getBigUint64(0, true)); const width = view.getUint16(8, true); const height = view.getUint16(10, true);
          const pixels = new Uint8ClampedArray(bytes.buffer, bytes.byteOffset + 12, bytes.byteLength - 12);
          const canvas = canvasRef.current; const context = canvas?.getContext("2d", { alpha: false });
          if (canvas && context && pixels.length === width * height * 4) {
            if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
            context.putImageData(new ImageData(pixels, width, height), 0, 0); frameSequence.current = sequence;
          }
        }
      } catch (error) { console.error("frame pull failed", error); }
      finally { polling.current = false; if (!stopped) requestAnimationFrame(pullFrame); }
    }
    requestAnimationFrame(pullFrame); return () => { stopped = true; };
  }, [status.phase]);

  const sendInput = useCallback((request: InputRequest) => { if (isTauri() && status.phase === "connected") void invoke("send_input", { request }); }, [status.phase]);
  function pointerPosition(event: React.MouseEvent<HTMLCanvasElement>) { const r = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0,Math.min(event.currentTarget.width-1,Math.round((event.clientX-r.left)*event.currentTarget.width/r.width))), y: Math.max(0,Math.min(event.currentTarget.height-1,Math.round((event.clientY-r.top)*event.currentTarget.height/r.height))) }; }
  function onMouseMove(event: React.MouseEvent<HTMLCanvasElement>) { mousePending.current=pointerPosition(event); if(!mouseRaf.current) mouseRaf.current=requestAnimationFrame(()=>{ if(mousePending.current) sendInput({kind:"mouseMove",...mousePending.current}); mouseRaf.current=0; }); }
  function onMouseButton(event: React.MouseEvent<HTMLCanvasElement>, pressed:boolean) { event.preventDefault(); event.currentTarget.focus(); const pos=pointerPosition(event); sendInput({kind:"mouseMove",...pos}); sendInput({kind:"mouseButton",button:event.button,pressed}); }
  function onKey(event: React.KeyboardEvent<HTMLCanvasElement>, pressed:boolean) { const scancode=SCANCODES[event.code]; if(scancode===undefined) return; event.preventDefault(); sendInput({kind:"key",scancode,pressed}); }
  function update<K extends keyof RdpConfig>(key:K,value:RdpConfig[K]) { setDraft(v=>({...v,[key]:value})); }

  return <div className="app">
    <header className="topbar"><div className="brand"><span className="brand-mark"><i/><i/><i/></span><strong>AIVirTeach</strong><span className="edition">IRONRDP CLIENT</span></div><div className="top-session"><span>REMOTE LAB / 01</span><strong>Linux 实验环境</strong></div><div className={`status-chip ${status.phase}`}><i/><span>{status.phase==="connected"?"真实会话进行中":status.phase==="connecting"?"正在连接":status.phase==="error"?"连接失败":"等待凭据"}</span></div></header>
    <main className="layout">
      <section className="stage-column">
        <div className="stage-toolbar"><div className="machine-title"><span className={`status-ring ${status.phase}`}/><div><strong>实验虚拟机</strong><small>{config.targetHost}:{config.targetPort}</small></div></div><div className="stage-actions"><button className="quiet-button" onClick={()=>setDialogOpen(true)}>连接设置</button>{status.phase==="connected"?<button className="danger-button" onClick={()=>void disconnect()}>断开</button>:<button className="primary-small" onClick={()=>setDialogOpen(true)}>连接</button>}</div></div>
        <div className={`rdp-stage real-stage ${status.phase}`}>
          <canvas ref={canvasRef} className={status.frameSequence>0?"rdp-canvas visible":"rdp-canvas"} tabIndex={0} onContextMenu={e=>e.preventDefault()} onMouseMove={onMouseMove} onMouseDown={e=>onMouseButton(e,true)} onMouseUp={e=>onMouseButton(e,false)} onWheel={e=>{e.preventDefault();sendInput({kind:"wheel",delta:Math.max(-32767,Math.min(32767,Math.round(-e.deltaY)))})}} onKeyDown={e=>onKey(e,true)} onKeyUp={e=>onKey(e,false)} onBlur={()=>{}} />
          {status.frameSequence===0&&<div className="center-state"><span className="idle-mark"><Icon type="screen"/></span><span className="state-kicker">IRONRDP NATIVE SESSION</span><h1>{status.phase==="connecting"?"正在建立真实 RDP 会话":status.phase==="error"?"连接失败":"准备连接远程桌面"}</h1><p>{status.message}</p>{status.phase!=="connecting"&&<button className="primary-button" onClick={()=>setDialogOpen(true)}>输入凭据并连接</button>}<small className="truth-note">画面区域只渲染服务器返回的真实像素，不包含模拟桌面。</small></div>}
        </div>
        <div className="stage-footer"><span><i className={status.phase}/> IronRDP native transport</span><span>{status.frameWidth||config.width} × {status.frameHeight||config.height}</span><span>键鼠输入</span><span>真实帧 #{status.frameSequence}</span></div>
      </section>
      <aside className="side-panel">
        <section className="side-section session-card"><div className="section-heading"><span><small>SESSION</small><strong>本次会话</strong></span><button onClick={()=>setDialogOpen(true)}>•••</button></div><div className="timer-card"><span>已连接时长</span><strong>{elapsed}</strong><div><i className={status.phase}/></div><small>{status.message}</small></div><dl><div><dt>RDP 引擎</dt><dd>IronRDP 0.17</dd></div><div><dt>服务器</dt><dd>Linux / xrdp</dd></div><div><dt>安全层</dt><dd>TLS 图形登录</dd></div><div><dt>本地隧道</dt><dd className="mono">{status.localPort??"未建立"}</dd></div></dl></section>
        <section className="side-section route-section"><div className="section-label"><strong>真实连接路径</strong><span className={status.phase}>{status.phase==="connected"?"已连通":status.phase==="connecting"?"建立中":"待连接"}</span></div><div className="route"><div className={status.phase!=="idle"&&status.phase!=="error"?"active":""}><span><Icon type="screen"/></span><p><strong>Rust / IronRDP</strong><small>本机协议与图形解码</small></p><i/></div><div className={status.phase==="connecting"||status.phase==="connected"?"active":""}><span><Icon type="server"/></span><p><strong>SSH 跳板机</strong><small className="mono">{config.bastionUser}@{config.bastionHost}</small></p><i/></div><div className={status.phase==="connected"?"active":""}><span><Icon type="vm"/></span><p><strong>RDP 虚拟机</strong><small className="mono">{config.targetHost}:{config.targetPort}</small></p><i/></div></div></section>
        <section className="side-section security-card"><span><Icon type="shield"/></span><div><strong>Windows 凭据管理器</strong><p>密码由当前 Windows 用户的安全存储保护，不写入 localStorage、源码或日志。</p></div></section>
      </aside>
    </main>
    {dialogOpen&&<div className="modal-backdrop" onMouseDown={()=>setDialogOpen(false)}><section className="settings-modal" role="dialog" onMouseDown={e=>e.stopPropagation()}><div className="modal-header"><div><span>REAL XRDP CONNECTION</span><h2>连接 Linux 实验机</h2><p>IronRDP 将使用 TLS 图形登录连接 xrdp。</p></div><button onClick={()=>setDialogOpen(false)}>×</button></div><div className="form-group"><strong>Linux 登录</strong><div className="form-row"><label>用户名<input autoFocus value={draft.rdpUsername} onChange={e=>update("rdpUsername",e.target.value)} placeholder="learner"/></label><label>域（通常留空）<input value={draft.rdpDomain} onChange={e=>update("rdpDomain",e.target.value)} placeholder="Linux 本地账户无需域"/></label></div><label>密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={draft.rememberPassword?"留空则读取 Windows 凭据管理器":"请输入 Linux 账户密码"} onKeyDown={e=>{if(e.key==="Enter")void connect()}}/></label><label className="toggle-row"><span><strong>安全记住密码</strong><small>保存到当前 Windows 用户的凭据管理器，不写入网页存储</small></span><input type="checkbox" checked={draft.rememberPassword} onChange={e=>update("rememberPassword",e.target.checked)}/><i/></label></div><div className="form-group"><strong>连接路径</strong><div className="form-row"><label>跳板机<input value={draft.bastionHost} onChange={e=>update("bastionHost",e.target.value)}/></label><label>SSH 用户<input value={draft.bastionUser} onChange={e=>update("bastionUser",e.target.value)}/></label></div><div className="form-row target"><label>RDP 目标<input value={draft.targetHost} onChange={e=>update("targetHost",e.target.value)}/></label><label>端口<input type="number" value={draft.targetPort} onChange={e=>update("targetPort",Number(e.target.value))}/></label></div></div><div className="form-group"><strong>桌面尺寸</strong><div className="form-row"><label>宽度<input type="number" value={draft.width} onChange={e=>update("width",Number(e.target.value))}/></label><label>高度<input type="number" value={draft.height} onChange={e=>update("height",Number(e.target.value))}/></label></div></div><div className="modal-actions"><button className="quiet-button" onClick={()=>setDialogOpen(false)}>取消</button><button className="primary-small" onClick={()=>void connect()}>连接 Linux 桌面</button></div></section></div>}
  </div>;
}
