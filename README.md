# Pocket Money

A family pocket-money ledger. The parent is the bank; the app records a virtual
balance per kid. All data lives in one Google Sheet in the parent's Google
Drive. No backend.

Spec: [docs/SPEC.md](docs/SPEC.md). Plan: [docs/PLAN.md](docs/PLAN.md).

## Stack

Vite, React, TypeScript, i18next (English, Hebrew, RTL), Google Identity
Services, Google Sheets / Drive / Picker APIs, PWA. Hosted as static files.

## Local development

```sh
npm install
cp .env.example .env   # fill in the three values below
npm run dev
```

`npm run check` runs typecheck, lint, format check and tests. CI runs the same.

## Google Cloud setup

1. Create a project at <https://console.cloud.google.com>.
2. APIs & Services > Library: enable **Google Drive API**, **Google Sheets API**
   and **Google Picker API**.
3. APIs & Services > OAuth consent screen: User type **External**, publishing
   status **Testing**. Add every family member's Google account under
   **Test users** (max 100). Scope: `.../auth/drive.file` only.
4. Credentials > Create credentials > **OAuth client ID**, type **Web
   application**. Authorized JavaScript origins: `http://localhost:5173` and
   your production URL. No redirect URIs are needed (token flow).
   Copy the client ID into `VITE_GOOGLE_CLIENT_ID`.
5. Credentials > Create credentials > **API key**. Restrict it:
   Application restrictions: **Websites**, add `localhost:5173/*` and your
   production origin. API restrictions: **Google Picker API** only.
   Copy it into `VITE_GOOGLE_API_KEY`.
6. Project number (Dashboard, not the project id) goes into
   `VITE_GOOGLE_APP_ID`.

The API key is shipped to the browser by design; the referrer restriction is
what protects it.

## Deploy (Cloudflare Pages)

Build command `npm run build`, output directory `dist`, Node 22. Set the three
`VITE_*` variables in the project's environment variables. Add the Pages URL
to the OAuth client's JavaScript origins and to the API key's referrers.

## How the data is protected

Every row the app writes ends with a `hash` column. Rows whose hash does not
match are ignored and listed in a warning in the app. This catches accidental
edits in Google Sheets; it is not a security boundary (the scheme is public).
Kid viewers have Drive `reader` access and cannot edit at all.

Two parents opening the app at the same moment on a payday can both append the
same allowance row. Readers keep the first row per id, so balances stay
correct. The Sheets API has no conditional write, so this cannot be fully
prevented client-side.
