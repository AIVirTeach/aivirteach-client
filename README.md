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

The deployed control plane currently exposes health and invitation-based JWT authentication. Login, access-token refresh, account activation, and logout are connected. Dashboard, courses, progress, and chat routes are not yet exposed by that server, so authenticated users see the frontend's local demo learning data for those areas until the matching APIs are deployed.

The server allows the frontend development origin `http://localhost:3001` through CORS. If you change the local frontend port, add that origin to the backend's `CORS_ORIGINS` setting.

Set `NEXT_PUBLIC_LEARNING_VM_URL` to the browser-accessible VM or remote desktop URL shown in the center of the Learning Lab. Without it, the Learning Lab displays its awaiting-connection state while course instructions remain available in the resizable left sidebar.

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
```
