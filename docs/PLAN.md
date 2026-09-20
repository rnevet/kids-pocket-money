# Pocket Money - Implementation Plan

Companion to [SPEC.md](./SPEC.md). Order matters: pure logic and the Google
access layer come before any screen, so every later step is testable and
the risky Google parts are proven early.

## Repo layout

```
src/
  main.tsx, App.tsx, router.tsx
  domain/        pure TS, no React, no Google. 100% unit-tested.
    money.ts       parse/format minor units, sum, compare
    allowance.ts   paydays(kid, today) -> ISO dates; allowance tx ids
    balance.ts     balances per kid from transactions
    goals.ts       progress (capped 0..1)
    schema.ts      row <-> object codecs for each tab, header constants
  google/        thin fetch wrappers around REST, take a token, throw typed errors
    auth.ts        GIS token client, token cache, silent refresh
    http.ts        fetch + Bearer, 401 -> refresh once -> retry, 403/429 mapping
    drive.ts       files.list/get/update, permissions.*, about.get
    sheets.ts      spreadsheets.create, values.get/append/update/batchGet
    picker.ts      load picker script, open with preselected fileId
  data/
    repository.ts  loadFamily(), appendTransactions(), upsertKid(), ...
                   the only module that knows both schema and sheets API
    bootstrap.ts   find/create/pick sheet flow; localStorage fileId cache
    crediting.ts   allowance run on load (uses domain/allowance + repository)
  state/         one React context: session, family data, role, refresh()
  ui/            screens/ and components/; CSS modules with logical props only
  i18n/          index.ts + locales/en.json, he.json
  theme/         theme.ts (system/light/dark), tokens.css
public/          manifest.webmanifest, icons
```

Rule: `domain/` imports nothing from `google/`, `data/` or React.
`ui/` never calls `google/` directly, only `state/` and `data/`.

## Best practices (project-wide)

- **Money**: strings in the sheet, integers (minor units) in memory. Parse
  with a strict regex, format with `(n/100).toFixed(2)` on write and
  `Intl.NumberFormat` on display. No float arithmetic anywhere.
- **Sheets as the source of truth**: read everything with one `batchGet`
  per refresh, never cache across reloads except the `fileId`. Always
  re-read before appending allowance rows.
- **Append-only writes** with `values.append` (`valueInputOption: RAW`,
  `insertDataOption: INSERT_ROWS`). Never write a computed balance.
- **Dedupe on read**: two parents can both append the same allowance row in
  a race. Balance code keeps the first row per `id` and ignores the rest.
  The deterministic id makes this safe.
- **Hand-edited rows are normal input**: codecs must tolerate blank cells,
  `TRUE`/`true`/`1`, trailing spaces, and unknown extra columns. Invalid
  rows are skipped and counted, shown as a warning, never a crash.
- **Header check**: on load, compare row 1 of each tab against the schema
  constants and show a clear error if a tab or column is missing.
- **Auth**: keep the token in memory only. One `http.ts` wrapper handles
  401 -> silent refresh -> retry once. Silent refresh can fail in browsers
  that block third-party cookies; the "Sign in again" fallback is required,
  not optional.
- **User email** comes from Drive `about.get?fields=user(emailAddress)`,
  which works under `drive.file`. No extra `email`/`openid` scope.
- **Role** from `files.get?fields=capabilities(canEdit,canShare)`. Hide
  edit UI when `canEdit` is false, and still handle a 403 from any write
  as "read-only" in case the permission changed since load.
- **Errors**: typed error class with `kind` (`auth`, `permission`,
  `not_found`, `rate_limit`, `network`, `schema`). UI maps `kind` to a
  translated message and an action (retry / sign in / pick sheet).
- **i18n**: all user-visible strings through `t()`. Keys are nested by
  screen. Dates via `Intl.DateTimeFormat(uiLocale)`. Emoji and currency
  codes are not translated.
- **RTL**: only logical CSS properties; lint with `stylelint` +
  `stylelint-use-logical`. Icons that imply direction (back arrow) flip via
  `[dir="rtl"]`.
- **Tests**: Vitest for `domain/` and `data/` codecs; `google/` tested with
  a fake `fetch`. One Playwright smoke run against a mocked Google layer is
  enough for MVP; do not test against real Google in CI.
- **Config**: `import.meta.env.VITE_*` read in one `config.ts` that fails
  loudly at startup if a value is missing.
- **Secrets**: none in the repo. `.env.example` with the three keys.
  The API key is public by design; restrict it by referrer in Cloud.
- **Commits**: one step below per PR-sized commit, conventional messages.

## Steps

### 0. Scaffold
- `npm create vite@latest` (react-ts), strict TS, ESLint + Prettier,
  Vitest, stylelint with logical-props rule.
- GitHub Actions: lint, typecheck, test, build on push.
- `README.md`: Google Cloud setup (spec section), env vars, local dev,
  Cloudflare Pages deploy (build `npm run build`, output `dist`).
- `.env.example`.

### 1. Domain (no UI)
- `schema.ts`: tab names, header arrays, `Kid`, `Transaction`, `Goal`,
  `Settings` types, `parseKidRow`/`kidToRow` etc.
- `money.ts`, `balance.ts`, `goals.ts`.
- `allowance.ts`: `paydays(frequency, day, startDate, today)`. Weekly:
  first date >= startDate whose weekday = day, then +7. Monthly: day of
  month 1-28, first >= startDate, then +1 month. Dates handled as local
  calendar dates (`YYYY-MM-DD` strings), never `Date` with time.
- Tests including the acceptance case: weekly, started 21 days ago,
  yields 3 or 4 paydays depending on weekday.

### 2. Google layer
- `auth.ts`: load GIS script, `initTokenClient` with `drive.file`,
  `requestAccessToken({prompt: ''})` for refresh, expose `getToken()`
  and `signIn()`/`signOut()` (`revoke`).
- `http.ts` retry wrapper; `drive.ts`, `sheets.ts` with only the calls
  the app uses.
- `picker.ts`: load `https://apis.google.com/js/api.js`, `gapi.load('picker')`,
  build `DocsView().setFileIds(fileId)` for join, plain spreadsheets view
  for "Open existing". Needs API key, app id and the OAuth token.
- Manual check in the browser before moving on: sign in, list files,
  create a sheet, read it back.

### 3. Sheet bootstrap
- `bootstrap.ts`: cached fileId -> `files.get` (drop cache on 404/403);
  else `files.list` with the `appProperties` query; 0/1/many handling.
- `createFamilySheet(name, currency)`: `spreadsheets.create` with the four
  tabs, write header rows and settings via `values.batchUpdate`, then
  Drive `files.update` to set `appProperties`.
- Setup screen (family name, default currency, first kid).

### 4. Read path and screens
- `repository.loadFamily()`: one `batchGet` over all tabs, run codecs,
  compute balances, return a `Family` object plus warnings.
- `state/`: context with `family`, `role`, `user`, `status`, `refresh()`.
- Screens: Sign in, Home, Kid detail (read-only), Settings skeleton.
- Kid-viewer role already works here with no edit controls.

### 5. Writes
- `appendTransactions`, `addKid`/`updateKid` (find row by id, `values.update`
  the row range), `addGoal`/`updateGoal`.
- Transaction dialog, Goal dialog, Add/Edit kid screen. Currency field is
  disabled once the kid has any transaction.
- `crediting.ts`: on load and on refresh, for each active kid compute
  paydays, diff against existing ids, append missing, then reload.
- Optimistic UI is not needed; reload after each write is simpler and
  matches "sheet is the truth".

### 6. i18n, RTL, theme
- i18next with `en` and `he`, detection from `navigator.languages`,
  override in localStorage. On change set `<html lang dir>`.
- Theme: `data-theme` on `<html>`, `prefers-color-scheme` listener,
  `theme-color` meta updated in the same effect.
- Walk every screen in Hebrew and check alignment.

### 7. Sharing and join
- Settings > Family members: `permissions.list`, `permissions.create`
  (`role: writer|reader`, `type: user`, `sendNotificationEmail: true`,
  `emailMessage` with `?join=<fileId>`), `permissions.delete`.
  Only shown when `canShare` is true.
- Join flow: read `join` from the URL, sign in, open Picker preselected on
  that fileId, store it, clear the query string.
- Test with a second Google account added as a test user.

### 8. PWA and release
- `vite-plugin-pwa` with `manifest.webmanifest`, icons, app-shell caching
  only (no data caching).
- Cloudflare Pages project, env vars set there, production origin added to
  the OAuth client and API key referrers.
- Run the acceptance criteria list from the spec end to end and record the
  results in the PR.

## Known risks

- Picker `setFileIds` on `DocsView` requires the picker to be opened with
  the same OAuth token; if the invited user has not accepted the Drive
  share yet, the file will not appear. Show a hint to check email first.
- Silent token refresh may be blocked (ITP / third-party cookies). The
  re-sign-in path must be tested on mobile Chrome and Safari.
- Sheets API quota is 300 reads/min per project; one `batchGet` per load
  keeps a family far below it.
- `Intl.supportedValuesOf` is missing in older Safari (< 15.4). Fall back
  to the four pinned currencies.
