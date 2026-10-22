# Backend-owned learning progress

V1 and V2 use one progress controller. It reads the course-scoped backend snapshot,
serializes reading/completion requests, ignores responses after unmount, reloads
after conflicting or uncertain writes, and never retries stale intent automatically.
The initial lesson comes from server reading position or next pending lesson.
Local-storage lesson IDs and percentages no longer determine completion.

Both layouts offer mark complete and mark incomplete. The UI explicitly separates
self-reported progress from assessment results and shows historical achievement.
A newer published course version requires a page reload before progress writes.
An unavailable progress API shows an error and disables completion until refreshed.
The admin preview renderer has no progress hook or authenticated progress calls.

Validation on 2026-10-23:

- TypeScript check passed.
- 22 unit files, 169 tests passed, including shared progress controller races.
- Cloudflare production build and artifact verification passed.
- 8 built-page HTTP rendering tests passed.
- ESLint passed for the new progress modules and updated V2 navigation/loader.

Browser interaction and real VM/assessment verification were not run. No merge or
deployment was performed. Deploy the companion server migration/API before this
client. Existing static HTML/local-storage completion sets are neither imported
nor deleted because they do not reliably identify the learner account.
