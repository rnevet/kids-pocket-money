# Pocket Money - Spec (MVP)

A simple family pocket-money ledger, inspired by the German KNAX Taschengeld app.
The parent is the bank. No real money moves; the app only records a virtual balance per kid.

## Principles

- Keep it simple. No backend, no own database.
- All data lives in one Google Sheet in the parent's Google Drive.
- Static web app (PWA), mobile-first, works on Android and desktop browsers.

## Tech stack

- Vite + TypeScript + React
- i18next + react-i18next (JSON translation files)
- Google Identity Services (token client) for OAuth in the browser
- Google Sheets API v4, Google Drive API v3, Google Picker API
- Hosting: any static host (Cloudflare Pages)
- PWA manifest + service worker for install-to-home-screen (no offline data sync in MVP)

Config via env vars:
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_API_KEY` (for Picker)
- `VITE_GOOGLE_APP_ID` (Cloud project number, for Picker)

## OAuth scope

Only `https://www.googleapis.com/auth/drive.file` (non-sensitive).
The app can access only files it created or files the user picked via Google Picker.
Sheets API calls work with this scope.

Access tokens expire after ~1 hour. Re-request silently (`prompt: ''`) on 401 and retry once. If silent refresh fails, show a "Sign in again" button.

## Data model (Google Sheet)

Created by the app on first sign-in, named "Pocket Money - <family name>".
Set Drive `appProperties: { pocketMoneyApp: "1", schemaVersion: "1" }` on the file.

Tabs (row 1 = headers):

### `settings`
| key | value |
|---|---|
| familyName | string |
| defaultCurrency | ISO 4217 code, e.g. ILS |

### `kids`
| id | name | avatar | currency | allowanceAmount | allowanceFrequency | allowanceDay | startDate | archived |
|---|---|---|---|---|---|---|---|---|

- `id`: uuid
- `avatar`: emoji
- `currency`: ISO 4217 code
- `allowanceFrequency`: `none` / `weekly` / `monthly`
- `allowanceDay`: weekly = 0-6 (0 = Sunday), monthly = 1-28
- `startDate`: ISO date, first possible payday
- `archived`: TRUE/FALSE (no hard delete)

### `transactions`
| id | kidId | date | amount | type | note | createdBy | createdAt |
|---|---|---|---|---|---|---|---|

- `amount`: decimal, positive = deposit, negative = withdrawal
- `type`: `allowance` / `deposit` / `withdrawal` / `adjustment`
- `createdBy`: Google email of the user
- Append-only. Corrections are new `adjustment` rows, never edits.
- Balance = sum of `amount` for the kid. Never stored.

### `goals`
| id | kidId | name | price | status | createdAt |
|---|---|---|---|---|---|

- `status`: `active` / `done` / `deleted`
- Goal price is in the kid's currency.

Money math: convert to integer minor units (cents/agorot) in code, never add floats. Write back with 2 decimals.

## Multi-currency (simple)

- Each kid has exactly one currency, chosen when the kid is created (default from `settings.defaultCurrency`).
- All of that kid's transactions and goals are in that currency.
- No exchange rates, no conversion, no cross-kid totals.
- Currency can be changed only while the kid has zero transactions.
- Currency picker: ILS, USD, EUR, GBP at the top, then any ISO 4217 code from `Intl.supportedValuesOf('currency')`.
- Format with `Intl.NumberFormat(uiLocale, { style: 'currency', currency })`.

## Allowance crediting

No server, so crediting happens on app load (and on manual refresh):

1. For each non-archived kid with a frequency other than `none`, compute all paydays from `startDate` up to today.
2. Transaction id for a payday is deterministic: `allowance:<kidId>:<YYYY-MM-DD>`.
3. Re-read `transactions`, append only paydays whose id does not exist yet.

The deterministic id prevents double credit when two parents open the app at the same time.
Changing the allowance amount affects future paydays only.

## Roles

Derived from the Drive file permission of the signed-in user (`files.get` with `fields=capabilities(canEdit,canShare)`):

- **Parent** (canEdit = true): full access.
- **Kid viewer** (canEdit = false): read-only. Sees balance, history and goals of all kids in the family (MVP; no per-kid filtering).

## Sharing from inside the app

Settings > Family members:

1. Parent enters an email and picks role: Parent (writer) or Kid viewer (reader).
2. App calls Drive `permissions.create` on the sheet with `sendNotificationEmail: true` and an `emailMessage` containing the invite link: `<app-url>/?join=<fileId>`.
3. List current members from `permissions.list`, allow removing with `permissions.delete`.

Joining:

1. Invitee opens the link and signs in with Google.
2. Because of `drive.file`, the app cannot see the file until the user grants it. Open Google Picker with `DocsView.setFileIds([fileId])` so the invited file is preselected. One click to confirm.
3. App stores `fileId` and continues.

## Finding the sheet on app load

1. Use `fileId` cached in localStorage, if accessible.
2. Else Drive `files.list` with `q: "appProperties has { key='pocketMoneyApp' and value='1' } and trashed=false"`.
3. One result: use it. Several: let the user choose. None: offer "Create new family" or "Open existing" (Picker).

## Screens

1. **Sign in**: app name, Google sign-in button.
2. **Setup** (first run): family name, default currency, add first kid.
3. **Home**: card per kid with avatar, name, balance, countdown to next payday, top active goal progress.
4. **Kid detail**: balance, buttons Deposit / Withdraw (parent only), goals with progress bars (balance / price, capped at 100%), transaction history newest first.
5. **Add/Edit kid**: name, emoji avatar, currency, allowance amount, frequency, day, start date, archive.
6. **Transaction dialog**: amount, note, date (default today).
7. **Goal dialog**: name, price. Mark done / delete.
8. **Settings**: family name, default currency, family members (sharing), language, theme, "Open sheet in Google Sheets" link, sign out.

## i18n and direction

- Translation files: `src/locales/<lang>.json` (i18next JSON format, nested keys). Ship `en.json` and `he.json`.
- Language detection: `navigator.languages`, first supported match, fallback `en`.
- Manual override in Settings: System / English / עברית. Stored in localStorage.
- Direction: `i18n.dir(lang)`. Set `<html lang="..." dir="...">` on every language change.
- CSS uses logical properties only (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`). No `left`/`right` in layout CSS.
- Dates and numbers via `Intl` with the UI locale.
- Adding a language = adding one JSON file and one entry in the language list.

## Theme

- Default follows OS: `prefers-color-scheme`, listen for changes.
- Manual override in Settings: System / Light / Dark. Stored in localStorage.
- Implement with CSS custom properties on `:root` and `:root[data-theme="dark"]`.
- Set `<meta name="theme-color">` to match the active theme.

## Out of scope (MVP)

Loans, chores/bonuses, educational content, offline editing, exchange rates, notifications, native app.

## Google Cloud setup (document in README)

1. Create project, enable Drive API, Sheets API, Google Picker API.
2. OAuth consent screen: External, Testing mode, add family members as test users (max 100).
3. OAuth client: Web application, add authorized JavaScript origins (localhost + production URL).
4. Create API key restricted to Picker API and the app's HTTP referrers.

## Acceptance criteria

- Parent signs in, creates family and 2 kids with different currencies, balances display in correct currency formats.
- Weekly allowance started 3 weeks ago produces exactly 3-4 allowance rows (depending on day), and reloading does not add duplicates.
- Two browsers signed in as two parents: both see the same data after reload.
- Invited kid viewer sees data but no edit controls; Drive API writes from that account fail gracefully.
- Switching OS language between Hebrew and English flips text and layout direction with no broken alignment.
- Theme follows OS and the manual override persists across reloads.
- Editing the sheet by hand (adding a transaction row) is reflected in the app after reload.
