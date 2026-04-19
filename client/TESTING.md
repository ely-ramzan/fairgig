# FairGig client — testing

## Layers

1. **Unit / component** — Vitest + Testing Library (`npm run test`).
2. **API mocks** — MSW in `src/test/setup.ts`; override per test with `server.use(...)`.
3. **Contract / live** — Point `RUN_LIVE=true` at running backends and extend `src/api/__tests__/contract` (optional; not required for PR CI).
4. **E2E** — Playwright (`npx playwright test`); set `PLAYWRIGHT_BASE_URL` if not using default `http://localhost:5173`.

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run test` | Vitest once |
| `npm run test:coverage` | Coverage report |
| `npm run e2e` | Playwright |
| `npm run budget` | Bundle budget placeholder (Phase 8 hardening) |

## Environment

Copy `client/.env.example` to `client/.env` and set `VITE_*_URL` for each microservice.

## Auth

`SKIP_AUTH_FOR_TESTING` in `src/config/testAuth.ts` is **`false`** for production-style flows. Set to `true` only for UI-only work without backends.
