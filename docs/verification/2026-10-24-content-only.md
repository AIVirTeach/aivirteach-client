# Course content-only rendering

## Contract

The published lesson API supplies a required `blocks` array and asset dictionary.
Course Markdown is no longer a response field or a rendering fallback. The API
boundary rejects missing/non-array blocks. Empty arrays remain valid empty lessons.
Malformed blocks produce a visible error instead of silently disappearing.

Lab V1 and V2 use the block renderer. V2 and the admin preview share
`CourseLessonView`. Preview messages retain invalid block input so the view can
show a diagnostic instead of pretending that content is empty. The origin and
parent-window checks remain in place.

The course-only `CourseLessonContent` component is removed. Tutor message Markdown,
learning state, snapshots, and VM lifecycle are unchanged.

## Verification

- Full client unit suite: 237 tests pass.
- `npm run typecheck` generates Cloudflare worker declarations; TypeScript passes.
- `npm run build:cloudflare` passes, including production API mode, origin/CSP,
  worker and binding verification.
- Built-worker HTTP rendering tests: 8 pass. These verify route shells, not
  authenticated course requests or browser interactions.
- Targeted ESLint and whitespace checks pass.
- Independent review runs 64 targeted tests across the API, shared renderer and
  preview protocol. Final review status is recorded in the PR.

No browser, production database, live Labs connection or deployment was used in
this code-only change. Database migration remains Owen's responsibility.

## Release dependency

Pair this client with the server content-only change. Before deployment, validate
all published and historical course content and its assets. This client rejects
old API responses with null blocks even if they still contain Markdown.

The new client can read valid blocks from the old server and ignore its extra
markdown field, so it can deploy before the server contract removal. Update the
admin server-side DTO before the API stops returning the draft body field.
Physical column deletion comes after old API/admin processes and CLI writers have
retired. See the server's content-only database handoff for the production gates.
