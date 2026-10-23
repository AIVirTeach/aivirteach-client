# Backend-owned learning progress and explicit tutor context

V1 and V2 use the backend completion records, separate reading commands, and actual loaded lesson version identity. Completing a lesson does not advance reading or grant assessment PASS. Reading saves queue the latest local navigation with a version/generation fence; a failed reading save does not prevent reading or explicitly scoped chat.

Each tutor request supplies a fresh request ID and the loaded lesson ID, course version ID and learning generation. Missing, loading or mismatched content disables sending. Version mismatch shows a reload action. Both transports use the same request owner to abort and ignore old-context replies.

Initial lesson selection is latched once per course/version/generation. A shared reading-position refresh cannot move the current tab. A temporarily unavailable snapshot does not erase the last local selection, but no chat is permitted without confirmed context. A new generation resets selection.

History GET includes the confirmed generation. Messages are keyed by enrollment/generation; superseded requests and reads started before local sends cannot overwrite the current conversation. Empty authoritative history clears old real messages. The server checks the same generation transactionally.

Client PR #24 consumes the contracts merged in server PRs #37 and #38. Client #23 and server #36 provide the foundations. Original client #22 remains a draft source record, not a merge target.

## Saved progress and restart

Both workspace layouts expose the same shadcn Save snapshot and History controls. Manual saves run through the learning-progress controller, which also serializes reading and completion writes. An uncertain response retains the exact request ID and command for an explicit retry. A revision refresh in the same learning round does not replace that command. A new round clears the old pending intent and saved-result display. Disposed controllers ignore late results.

History uses cursor pagination and the course version stored with each snapshot. Detail counts include only completed lessons in that version's syllabus. Legacy achievements show their known completion time without inventing a syllabus or progress percentage. History refreshes after a confirmed save. There is no restore action.

Catalog restart captures the confirmed generation, revision and version. An uncertain response retains the command across dialog close and reopen in the same mounted page. A conflict discards it so the next attempt reads fresh progress. The backend archives progress before reset; chat and lab state reset, and consumed quota remains consumed. Pending commands do not survive a full page reload.

The storage hooks subscribe to persisted values, and lesson loading derives from the selected request.

## Console connection ownership

Both layouts use `useConsoleSession` and `ConsoleSessionController`. The controller owns manual start, ticket polling every 2.5 seconds, the 120-second deadline, errors, retry and cancellation. A running workspace must match the active enrollment. Scope changes, stop, timeout and unmount invalidate pending requests. The hook masks a previous scope's ticket during render, before effects bind a new scope. The pages retain VM provisioning, heartbeat and server start/stop actions.

`ConsoleViewer` owns the Guacamole connection. Enrollment, lab and ticket identity determine connection replacement. Updating the error callback does not disconnect; notifications call the latest handler. Old token responses, SDK callbacks and clipboard completions cannot affect a replacement connection. Clipboard commands remain usable across ordinary renders and are cleared when a connection ends.

The old per-page polling timers and the separate console-state/request-owner helpers were removed. This change does not modify the backend, database tables or migrations.

## Verification on 2026-10-23

Implementation head: `f2323b0`. Backend contract baseline: server merge `d573fab`. Console regression baseline: client `46fa7b8`.

- `npm run test:unit`: 33 files, 229 tests passed, including 13 console tests in three files.
- `npm run lint`: zero errors and seven existing warnings. No correctness suppressions were added; the viewer clipboard callback dependency warning is also resolved.
- `WRANGLER_LOG_PATH=/private/tmp/aivirteach-wrangler-logs npm run typecheck`: passed.
- `WRANGLER_LOG_PATH=/private/tmp/aivirteach-wrangler-logs npm run build:cloudflare`: production build and artifact checks passed.
- `node --test tests/rendered-html.test.mjs`: eight built-page HTTP checks passed.
- `git diff --check`: passed.

Independent source reviews checked the backend contracts, generation ownership, snapshot projection, and late console responses. Review findings led to fixes for incomplete lesson counting, old-generation save display, stale console callbacks and V1 retry controls hidden during progress reload failure. Regression tests cover request reuse, disposal, generation changes, history pagination, stale detail responses and console stop/resume ownership. Two further independent source reviews checked the shared console controller, React hook, both layouts and viewer cleanup; neither found a remaining confirmed defect. The comment audit removed one new narrative comment and retained the executable Vitest environment directives.

The mounted console regression test was run against a temporary copy of `ConsoleViewer` from `46fa7b8`: changing only the error callback caused two token exchanges instead of one, and the test failed. The same test passes on the refactor. The fixtures were removed after the check.

`npm run test:unit -- app/workspace/console-viewer.test.tsx app/workspace/console-session.test.ts app/workspace/use-console-session.test.tsx` passes all 13 tests. These cover callback-only rerenders, latest error delivery, identity replacement, stale token/SDK/clipboard completion, polling errors and deadlines, stop/resume on the same workspace, enrollment changes and StrictMode cleanup/setup. React mounts in jsdom; API and Guacamole calls are mocked. This verifies component lifecycle behavior, not the live remote desktop protocol.

Full-page browser interactions, real Labs/VM, database migration and production deployment have not been verified in this client pass. Built-page HTTP checks do not establish browser acceptance. No merge or deployment was performed. Runtime rollout requires the server migrations and coordinated client/server deployment because the chat, history and restart contracts changed.
