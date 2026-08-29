# AIVirTeach frontend

React 19 and TypeScript frontend built with the Next.js App Router through Vinext.

## Start locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3001`. The port is fixed in `vite.config.ts`.

Backend selection is controlled by one value in the ignored `.env.local`:

```dotenv
NEXT_PUBLIC_BACKEND_MODE=local
```

Use `local` for `http://localhost:4000/api/v1`, or change it to `remote` for `https://aivirteach-server.vercel.app/api/v1`. Restart `npm run dev` after changing it. The URLs can be customized with `NEXT_PUBLIC_LOCAL_API_BASE_URL` and `NEXT_PUBLIC_REMOTE_API_BASE_URL`; `.env.example` contains the complete configuration.

Local mode uses the demo-account picker and `X-Demo-User-Id` contract. Remote mode uses invitation-based JWT login, refresh-token rotation, account activation, and logout.

The configured control plane is the source of learner, course, progress, and chat data. Remote mode also uses its invitation-based JWT login, access-token refresh, account activation, and logout routes.

The server allows the frontend development origin `http://localhost:3001` through CORS. If you change the local frontend port, add that origin to the backend's `CORS_ORIGINS` setting.

### AIVir Teacher chat

The Learning Lab waits for the active enrollment before opening chat. It derives one stable thread for each learner/course pair as `chat:v1:<encoded learner id>:<encoded course id>` and uses that same thread for every operation:

- `GET /api/v1/chat/threads/:threadId/messages` loads the server-persisted history.
- `POST /api/v1/chat/threads/:threadId/messages` sends `{ "text": "...", "courseId": "...", "lessonId": "..." }` and returns the persisted `studentMessage` and `tutorMessage` pair. The course and lesson are captured from the currently displayed workspace step so the server can validate enrollment and build the correct teaching context.

Only messages returned by those server APIs are rendered as conversation messages. The composer is disabled while a turn is being created. If the POST response is interrupted, the client reloads the thread before offering another send, so a message that the server already saved is restored instead of being replaced by a synthetic error message. The chat client never connects directly to Labs, a learner VM, or Guacamole.

The Learning Lab requests the current learner's VM session from `POST /api/v1/me/lab/session`. While the backend reports `starting`, the page polls at the interval returned by the API. Once the session is `ready`, its opaque `/guacamole/?data=...` URL is loaded in the embedded remote-desktop frame. Connection failures are shown in the workspace with a retry action.

For local development, Vite proxies `/guacamole` HTTP and WebSocket traffic to `GUACAMOLE_PROXY_TARGET`, which defaults to `http://127.0.0.1:8080`. A typical `.env.local` override is:

```dotenv
GUACAMOLE_PROXY_TARGET=http://127.0.0.1:8080
```

Guacamole must therefore be available at `http://127.0.0.1:8080/guacamole/`, and the backend must return a browser-facing relative `embedUrl` beginning with `/guacamole/`. Restart `npm run dev` after changing the proxy target. In deployment, route `/guacamole/` through the public application's same-origin reverse proxy and preserve WebSocket upgrades; do not expose the VM's RDP port to the browser.

If the public route is changed, set `NEXT_PUBLIC_GUACAMOLE_PUBLIC_PATH` to the same absolute path used by the server's `GUACAMOLE_PUBLIC_PATH` and the reverse proxy. Vite rewrites that public development path to Guacamole's internal `/guacamole` context.

Local development intentionally leaves the Cloudflare Vite runtime bridge disabled so it cannot consume Guacamole WebSocket upgrades. Production builds still include the Cloudflare plugin.

## Desktop app (Tauri + Workspace + Guacamole)

The desktop MVP is a restricted Tauri 2 shell around this complete, deployed React/Vinext application. In development it opens `http://localhost:3001`; a release build opens the HTTPS origin supplied in `AIVIRTEACH_DESKTOP_APP_URL`. The Workspace still requests `POST /api/v1/me/lab/session` and embeds the same-origin `/guacamole/` ticket, so the desktop binary never receives a Labs service token, VM address, or RDP password.

```bash
# Linux/macOS development (after installing Tauri prerequisites)
npm install
npm run desktop:dev

# Release build: point at the already deployed frontend + /guacamole proxy
export AIVIRTEACH_DESKTOP_APP_URL=https://learn.example.com/
npm run desktop:build
```

The current Vinext output is an RSC/Worker application rather than a static SPA, so `dist/client` is intentionally not embedded in the binary. The Rust shell denies cross-origin top-level navigation, denies new WebView windows, and grants the remote site no Tauri IPC capabilities. See [the desktop operations guide](docs/desktop-app.md) for prerequisites, the three-service startup order, production reverse proxy, release gates, and troubleshooting.

## Application entry points

- `app/layout.tsx` — root HTML layout, metadata, favicon, and global stylesheet.
- `app/page.tsx` — `/`; currently redirects visitors to `/login`.
- `worker/index.ts` — hosted Cloudflare Worker request entry point.
- `vite.config.ts` — Vinext/Vite development and build configuration.

## Pages you can edit

- `app/login/page.tsx` — login screen.
- `app/dashboard/page.tsx` — dashboard and notifications.
- `app/courses/page.tsx` — course catalog and active-course selection.
- `app/workspace/page.tsx` — Learning Lab, editor, and AI tutor chat.
- `app/analysis/page.tsx` — Progress analytics.
- `app/settings/page.tsx` — application settings.
- `app/settings/profile/page.tsx` — learner profile settings.

## Shared code you can edit

- `app/globals.css` — colors, spacing, layouts, dark mode, and responsive styles.
- `app/components/Sidebar.tsx` — shared navigation and collapse behavior.
- `app/components/Avatar.tsx` — reusable avatar rendering.
- `app/hooks/useLearnerProfile.ts` — backend learner state and mutations.
- `app/lib/api.ts` — typed NestJS API client and demo-user header selection.
- `app/lib/mock-profile.ts` — default demo data shown in the UI.
- `app/lib/courses.ts` — course catalog and active-course storage helpers.
- `public/` — logos, icons, chart images, and other browser assets.

## Usually leave these alone

- `worker/`, `build/`, `.openai/`, and `vite.config.ts` — runtime and hosting integration.
- `db/`, `drizzle/`, and `drizzle.config.ts` — future database schema and migrations.
- `examples/` — optional reference implementation, not part of the active UI.
- `package-lock.json` — generated dependency lockfile.

## Useful commands

```powershell
npm run dev
npm run build
npm test
npm run lint
npm run desktop:doctor
npm run desktop:dev
npm run desktop:build
```
