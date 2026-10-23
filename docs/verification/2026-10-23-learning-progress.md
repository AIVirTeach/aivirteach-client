# Backend-owned learning progress and explicit tutor context

V1 and V2 use the backend completion records, separate reading commands, and actual loaded lesson version identity. Completing a lesson does not advance reading or grant assessment PASS. Reading saves queue the latest local navigation with a version/generation fence; a failed reading save does not prevent reading or explicitly scoped chat.

Each tutor request supplies a fresh request ID and the loaded lesson ID, course version ID and learning generation. Missing, loading or mismatched content disables sending. Version mismatch shows a reload action. Both transports use the same request owner to abort and ignore old-context replies.

Initial lesson selection is latched once per course/version/generation. A shared reading-position refresh cannot move the current tab. A temporarily unavailable snapshot does not erase the last local selection, but no chat is permitted without confirmed context. A new generation resets selection.

History GET includes the confirmed generation. Messages are keyed by enrollment/generation; superseded requests and reads started before local sends cannot overwrite the current conversation. Empty authoritative history clears old real messages. The server checks the same generation transactionally.

The root fix is in client PR #24 paired with server PR #37. Client #23 and server #36 are foundation PRs. No separate chat implementation PR is needed. Original client #22 is retained as a draft source record, not a merge target.

## Verification on 2026-10-23

Implementation commits: `84ca87e`, `566aa6b`; regression test follow-up: `506a490`.

- Full client unit suite: 25 files, 194 tests passed.
- TypeScript check passed.
- Cloudflare production build and artifact verification passed.
- Eight built-page HTTP rendering tests passed.
- Independent review found and then verified fixes for shared-pointer-driven initial selection and generation-unscoped history. Final focused review ran 5 files, 39 tests and found no new confirmed blocking defect in that scope.
- New lifecycle/API modules pass scoped ESLint. The broader workspace-page command reports seven errors in unchanged VM/local-storage statements and one existing image warning. The same command on commit `84ca87e` reported zero errors and one warning, so these are newly surfaced diagnostics, not a baseline lint pass. The broader command remains failing and is not reported as green.

Browser interactions, mounted React lifecycle integration, real Labs/VM and production deployment have not been verified. The rendered-page tests are HTTP checks, not browser acceptance. No merge or deployment was performed. Keep this PR draft while completing its remaining review/release gates. Apply server migrations before runtime deployment and coordinate the breaking history/chat contract with the client.
