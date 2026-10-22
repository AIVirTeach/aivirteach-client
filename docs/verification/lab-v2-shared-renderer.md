# Lab V2 shared course rendering

Implemented on `feat/lab-v2-shared-renderer`, based on client main `723f44d`. Includes the production preview configuration from PR #20, which was already deployed but not merged when work began. Server UI PR #32 is merged as `aacaf55`.

## Runtime contract

- `WorkspaceV2` loads the active enrollment and course outline. `CourseLearningPath` selects a real lesson and loads it through `api.lesson`.
- `CourseLessonView` owns the course heading, reading surface and shared block renderer. The preview route imports the same component and receives drafts through the existing ready/postMessage protocol.
- The preview listener checks both the configured origin and `window.parent`. It does not fetch authenticated data or receive a VM callback.
- Server `CoursesService.getDetail/getLesson` uses the latest published version, not an enrollment-pinned version. New and existing learners see the latest published content on the next fetch. Reload the workspace after publishing to refresh its outline too.
- An empty blocks array means empty content. Only absent/null blocks use the existing Markdown fallback. No database/API/schema change is required.
- Code copying uses an injected VM callback. Browser clipboard and VM results are independent; a denied browser permission does not block copying to a connected VM. Preview copies locally only.
- Course requests have a generation fence. A late success/failure or an unmounted request cannot replace the active lesson. Loading and failure never display the previously selected lesson as current.

## Visual and interaction mapping

The shared CSS follows the final reading styles in `public/course-designs/ai-daily-briefing-v5-soft-neubrutalism-zh-CN.html`: warm paper, framed title and body, green-gray code panels, restrained callouts, container-width responsive spacing.

| Static course feature | Shared implementation |
| --- | --- |
| Heading, paragraph, lists, divider | Existing heading/paragraph/bulletList/numberedList/divider blocks |
| Terminal/file/plain code and copy | Code block plus shared CopyButton and optional VM callback |
| Steps, tips, warnings | Step and callout blocks |
| Tables, images with zoom, links | Table, image and resourceLink blocks |
| Explanations beside code | AnnotatedCode block |
| Node flow | Diagram block |
| Course navigation | Published module/lesson outline, previous/next and grouped selector |

Lesson-specific decorative HTML, static local progress checkboxes and arbitrary embedded scripts are not course block data. No new schema or renderer duplicates were added to emulate them. Chat, VM and assessment/progress writes remain outside the preview. The old static HTML files remain as design references, not runtime lesson sources. The bundled-design API, theme selector and iframe DOM clipboard bridge have been removed.

## Repeatable checks

```sh
npm run test:unit
npm run typecheck
npm run build:cloudflare
node --test tests/rendered-html.test.mjs
```

`typecheck` generates local Cloudflare runtime declarations under ignored `work/`. Optional local D1 binding is declared separately; production continues using the remote API. Two existing TypeScript issues were corrected: React keyboard event import and tuple-union spread in Sidebar labels.

- 21 unit test files / 163 tests pass, including equal rendered markup for all 13 block types in preview and learner mode, malformed drafts, Markdown fallback, selection restoration, out-of-order requests, retry/disposal and clipboard outcomes.
- TypeScript and targeted ESLint pass.
- Cloudflare production build verifies the worker bindings, preview CSP and compiled admin origin.
- The built worker passes 8 HTTP-rendered page tests.

## Acceptance boundary

No browser automation was used. Static markup equality does not prove pixel equality, focus behavior or actual clipboard permissions. The real browser sequence of edit, ready/payload exchange, save, publish and viewing the updated lesson remains a manual acceptance item. No production course data was modified for testing. VM clipboard was tested through the callback contract, not a live VM session.

## Operator trial

1. Log into the deployed admin with the existing operator account.
2. Open a test course draft and edit a lesson. Check its embedded preview, including images and code blocks.
3. Save and publish the test course. Use a learner account enrolled in that course to open `/workspace`, then reload and choose the same lesson in V2.
4. Compare the content areas at the same width. The admin preview omits the Lab's course navigation, chat and VM frame.

Operator and learner accounts have separate authentication flows. The operator account is for the admin URL; it is not automatically a learner account.

## Admin deployment verification

Server UI commit `aacaf55` is deployed as `dpl_9maXoKw8vFCcwLvXisK45wWkSGc1` at `https://aivirteach-admin.vercel.app`. The existing operator account successfully authenticated against the production API. An authenticated HTTP request to the deployed `/courses` page confirmed the new UI and course list. No password or token is stored in this repository.
