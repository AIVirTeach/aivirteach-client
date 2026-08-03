# AIVirTeach frontend

React 19 and TypeScript frontend built with the Next.js App Router through Vinext.

## Start locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3001`. The port is fixed in `vite.config.ts`.

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
- `app/hooks/useMockProfile.ts` — mock profile state and interactions.
- `app/lib/mock-profile.ts` — default demo data shown in the UI.
- `app/lib/courses.ts` — course catalog and active-course storage helpers.
- `app/api/mock/profile/route.ts` — mock profile API endpoint.
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
