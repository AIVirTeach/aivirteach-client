# Welcome response contract regression

## Reproduction and fix

`CoursesService.getWelcome` returns `overviewAssetId`, `overviewHeading`,
`overviewParagraphs`, `howItWorksSteps`, and a nullable `finalOutcome` string.
The client declared and rendered a nested response with `overview.heading`.
Both populated and empty welcome rows therefore crashed after a successful GET.

The initial page regression run reproduced this on unchanged main code:

```text
Tests  2 failed | 2 passed (4)
TypeError: Cannot read properties of undefined (reading 'heading')
CourseWelcomePage app/courses/welcome/page.tsx:86:66
```

The client now models the actual wire response and maps it to a page view.
Empty welcome fields use the existing course metadata. Invalid JSON steps produce
a visible error rather than a render exception. The existing 404 fallback remains.
The page reads the image asset ID from the actual API response.

## Verification

- Full client unit suite: 34 files, 236 tests pass.
- Seven page tests pass: published content and workspace entry, empty row, 404,
  request failure, malformed steps, image asset, and no active enrollment.
- `npm run typecheck` passes after generating the Cloudflare worker types.
- `npm run build:cloudflare` passes, including artifact/CSP verification.
- Targeted ESLint has no errors; the existing `no-img-element` warning remains.
- Independent review compared the page to the server response and found no
  confirmed new regression in the initial four-test scope.

Browser retesting and deployment are not performed for this fix. The earlier
production acceptance observed a blank welcome page; this regression reproduces
the matching render exception with the server response shape.

## Separate unresolved observations

The earlier acceptance also observed one tutor fallback and one browser
`ERR_CONNECTION_CLOSED`. Neither is established as the same defect. Chat's
fallback can result from an upstream failure, an absent/invalid terminal result,
or a persistence failure. Code inspection alone cannot identify which happened
in that production request. No retry or timeout changes are included here.

Independent chat review ran 3 server suites with 66 passing tests. It found no
confirmed cause for the observed production failure. Invalid result frames and
EOF without a result lack diagnostic logging; an upstream error event is forwarded
as progress. This limits diagnosis and remains separate from the welcome fix.
