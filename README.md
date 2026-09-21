# Pocket Money

Live: <https://pocketmoney.nevet.me>

A family pocket-money ledger. The parent is the bank; the app records a virtual
balance per kid. All data lives in one Google Sheet in the parent's Google
Drive. No backend.

Spec: [docs/SPEC.md](docs/SPEC.md). Plan: [docs/PLAN.md](docs/PLAN.md).

## Just use it

Open <https://pocketmoney.nevet.me>, sign in with Google, and create your
family. That is the whole setup.

- The app asks for one permission, `drive.file`: it can see and edit only the
  sheet it creates for you (or one you open through the Google file picker).
  It cannot read the rest of your Drive.
- Your data lives in a Google Sheet in your own Drive. There is no server and
  no database on our side. Sign out and the app forgets everything except the
  id of your sheet, which it keeps in your browser to skip the picker next time.
- Invite the other parent (editor) or a kid (viewer) from Settings. They sign
  in with their own Google account.
- Install it as an app from the browser menu (Add to Home Screen) to get an
  icon on the phone.

If you would rather not depend on a hosted instance, run your own copy below.
Same code, same sheet format, your own Google Cloud project.

## Stack

Vite, React, TypeScript, i18next (English, Hebrew, RTL), Google Identity
Services, Google Sheets / Drive / Picker APIs, PWA. Hosted as static files.
The UI font is Rubik (SIL Open Font License), self-hosted from `public/fonts`.

## Run your own copy

Each family hosts its own copy under its own Google Cloud project. Nothing is
shared between families, and there is no central server. The whole setup takes
about 20 minutes and costs nothing.

### 1. Fork this repository

Click **Fork** on GitHub. Cloudflare will build from your fork.

### 2. Google Cloud (about 15 minutes)

1. Create a project: <https://console.cloud.google.com/projectcreate>.
   Any name, for example `pocket-money`.
2. Enable the three APIs (each page has an **Enable** button):
   - <https://console.cloud.google.com/apis/library/drive.googleapis.com>
   - <https://console.cloud.google.com/apis/library/sheets.googleapis.com>
   - <https://console.cloud.google.com/apis/library/picker.googleapis.com>
3. Consent screen: <https://console.cloud.google.com/auth/overview>.
   Click **Get started**. App name `Pocket Money`, your email as support and
   contact, audience **External**. Finish.
4. Test users: <https://console.cloud.google.com/auth/audience>. Add your
   Google account and any other parent's. Add a kid's account only if that kid
   has one and should get read-only access. In _Testing_ status up to 100
   test users can sign in. To let anyone sign in, click **Publish app** on
   the same page. Because the app only asks for the non-sensitive `drive.file`
   scope, publishing needs no Google review and shows no "unverified app"
   warning. Google does require a homepage, privacy policy and terms URL under
   Branding first; this repo serves them at `/privacy/` and `/terms/`.
5. OAuth client: <https://console.cloud.google.com/auth/clients>. Create
   client, type **Web application**. Under _Authorized JavaScript origins_ add
   `http://localhost:5173`. Leave redirect URIs empty. Save and copy the
   **Client ID**. You will come back once to add your Cloudflare URL.
6. API key: <https://console.cloud.google.com/apis/credentials>. Create
   credentials, **API key**. Then edit it: _Application restrictions_ =
   Websites, add `localhost:5173`; _API restrictions_ = Restrict key, tick
   only **Google Picker API**. Save and copy the **key**.
7. Project number: <https://console.cloud.google.com/iam-admin/settings>.
   Copy the **Project number** (digits), not the project ID.

### 3. Cloudflare Pages (about 5 minutes)

1. Go to <https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages>,
   choose **Connect to Git**, pick your fork. Production branch `main`.
   Framework preset **Vite**, build command `npm run build`, output directory
   `dist`.
2. Under _Environment variables_ add:

   | Variable                | Value from |
   | ----------------------- | ---------- |
   | `VITE_GOOGLE_CLIENT_ID` | step 2.5   |
   | `VITE_GOOGLE_API_KEY`   | step 2.6   |
   | `VITE_GOOGLE_APP_ID`    | step 2.7   |

3. Save and deploy. Copy the resulting URL, for example
   `https://pocket-money-abc.pages.dev`.
4. Add that URL to the OAuth client's JavaScript origins (step 2.5) and to
   the API key's website restrictions (step 2.6). Use the origin without a
   trailing slash.

Any other static host works the same way: build with the three variables set,
publish `dist`, register the URL with Google.

### 4. First run

Open the URL, sign in with an account from step 2.4, and create the family.
The app creates a spreadsheet named `Pocket Money - <family>` in that
account's Google Drive. Other parents are invited from **Settings > Family
members** and open the app with the link in the invitation email.

All three values are public by design and end up in the built JavaScript.
The referrer restriction on the API key and the origin list on the OAuth
client are what stop other sites from using them.

## Local development

```sh
npm install
cp .env.example .env   # the same three values as above
npm run dev            # http://localhost:5173
```

`npm run check` runs typecheck, lint, format check and tests. CI runs the same.

## How the data is protected

Every row the app writes ends with a `hash` column. Rows whose hash does not
match are ignored and listed in a warning in the app. This catches accidental
edits in Google Sheets; it is not a security boundary (the scheme is public).
Kid viewers have Drive `reader` access and cannot edit at all.

Two parents opening the app at the same moment on a payday can both append the
same allowance row. Readers keep the first row per id, so balances stay
correct. The Sheets API has no conditional write, so this cannot be fully
prevented client-side.

## License

[MIT](LICENSE).
