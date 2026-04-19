# FairGig Frontend — Deployment

The frontend is a static Vite/React SPA that expects to talk to 4–6 backend
services. All service base URLs are **runtime-configurable**, so you can
redirect traffic to a different backend without rebuilding the client.

## Deploying to Vercel

1. **Import the repo**, set **Root Directory** to `client`, framework preset `Vite`.
2. Vercel will pick up `client/vercel.json` automatically:
   - Build command: `npm run build`
   - Output directory: `dist`
   - SPA rewrites so `/login`, `/dashboard`, etc. don't 404 on refresh.
   - The serverless function at `client/api/config.ts` is deployed as `/api/config`.
3. In **Project → Settings → Environment Variables**, add any of these that
   apply. Leave unused services blank — the UI will show "Service unavailable"
   rather than making bad calls.

   | Variable           | Example                                   | Required |
   | ------------------ | ----------------------------------------- | -------- |
   | `AUTH_URL`         | `https://fairgig-nu.vercel.app`          | yes      |
   | `ANOMALY_URL`      | `https://fairgig-delta.vercel.app`       | yes      |
   | `ANALYTICS_URL`    | `https://fairgig-analytics.vercel.app`   | yes      |
   | `GRIEVANCE_URL`    | `https://fairgig-grievances.vercel.app`  | yes      |
   | `EARNINGS_URL`     | `https://fairgig-earnings.vercel.app`    | optional |
   | `CERTIFICATE_URL`  | `https://fairgig-certificate.vercel.app` | optional |

4. **Redeploy**. After that, changing any of these values takes effect
   **immediately** on the next request — no rebuild required, because they
   are served by `/api/config`, not baked into the JS bundle.

## How configuration is resolved

On every page load the client resolves service URLs in this order (first
non-empty wins per service):

1. **localStorage override** — set per-browser via the `/settings/services`
   page. Useful for a developer temporarily pointing at staging or a local
   server, without affecting anyone else.
2. **`/api/config`** — Vercel serverless function that reads `process.env`
   at request time. This is the normal production path.
3. **`/config.json`** — a static asset in `public/`. Editable if you need to
   change URLs without env vars (e.g. deploying to S3/Netlify).
4. **`VITE_*_URL`** env vars — baked in at build time; last-resort baseline.

## Local development

Copy `client/.env.example` to `client/.env`, then:

```bash
npm install
npm run dev
```

To point at local services, either edit `client/.env` or visit
`http://localhost:5173/settings/services` and paste the URLs.

## Verifying a deploy

- `https://your-domain/api/config` returns JSON with the resolved service URLs.
- `https://your-domain/` redirects to `/landing` when logged out or to
  `/dashboard` / `/verify` / `/analytics` based on role when signed in.
- `/settings/services` reports "Configured" / "Unavailable" per service and
  shows the env defaults beneath each field.
