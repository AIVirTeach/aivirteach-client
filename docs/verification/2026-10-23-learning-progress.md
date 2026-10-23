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

The lint fixes replace effect-driven storage initialization with subscriptions and derive lesson loading from the selected request. Console state clears when workspace status changes. Request ownership rejects replies from an earlier console start, including stop and resume on the same workspace.

## Verification on 2026-10-23

Implementation head: `11aa11e`. Backend contract baseline: server merge `d573fab`.

- `npm run test:unit`: 31 files, 219 tests passed.
- `npm run lint`: zero errors and eight existing warnings. The seven previous workspace errors are resolved without lint suppressions.
- `WRANGLER_LOG_PATH=/private/tmp/aivirteach-wrangler-logs npm run typecheck`: passed.
- `WRANGLER_LOG_PATH=/private/tmp/aivirteach-wrangler-logs npm run build:cloudflare`: production build and artifact checks passed.
- `node --test tests/rendered-html.test.mjs`: eight built-page HTTP checks passed.
- `git diff --check`: passed.

Independent source reviews checked the backend contracts, generation ownership, snapshot projection, and late console responses. Review findings led to fixes for incomplete lesson counting, old-generation save display, stale console callbacks and V1 retry controls hidden during progress reload failure. Regression tests cover request reuse, disposal, generation changes, history pagination, stale detail responses and console stop/resume ownership. The comment audit found one added narrative comment; it was removed. No correctness suppressions were added.

Browser interactions, mounted React lifecycle integration, real Labs/VM, database migration and production deployment have not been verified in this client pass. Built-page HTTP checks do not establish browser acceptance. No merge or deployment was performed. Runtime rollout requires the server migrations and coordinated client/server deployment because the chat, history and restart contracts changed.
