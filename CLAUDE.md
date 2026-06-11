# CLAUDE.md

Postline is an open-source, **single-user, self-hostable** social media scheduler (React + Azure Functions). Each deployment serves exactly one person; design decisions assume that.

## Commands

```bash
npm run install:all                # install client + api deps
./dev.sh                           # run API (:7071) + client (:5173) together
npm --prefix client run build      # client production build (also the main client check)
cd api && find src -name '*.js' -print0 | xargs -0 -n1 node --check   # API syntax check
node scripts/hash-password.mjs --generate                            # admin password + hash
az bicep build --file infra/main.bicep --outfile infra/azuredeploy.json  # keep ARM in sync
```

There is no test framework. Verification convention: `node --check` on changed API files, client build, plus a throwaway smoke script (`node __smoke.mjs`-style, deleted after) for security-sensitive modules. CI (`.github/workflows/ci.yml`) runs the same checks.

## Architecture (the 60-second version)

- `client/` — Vite + React SPA. Auth state in `context/AuthContext.jsx` (session token in sessionStorage); all API calls via `services/api.js` (axios + bearer interceptor). Dev proxy: `/api` → `localhost:7071`.
- `api/` — Azure Functions v4, Node 20, **ESM** (`"type": "module"`; functions auto-discovered via `main: src/functions/*.js`).
  - `functions/auth.js` — password login, optional OIDC start/callback/redeem, `/auth/providers`.
  - `functions/accounts.js` — social-account connect/callback/finalize/disconnect.
  - `functions/posts.js`, `media.js`, `publish.js`, `scheduler.js` (timer, every minute).
  - `services/` — `cosmos.js`, `blob.js`, `crypto.js` (AES-256-GCM at-rest token encryption), `mediaSecurity.js` (SSRF guards + SAS URLs), `password.js` (scrypt), `session.js` (HS256 session JWT), `rateLimit.js`, `loginProviders.js` (OIDC login), `social/oauth.js` (publishing token exchange), `social/{facebook,instagram,twitter,linkedin}.js` (publishers).
- Hosting: SWA Free (client) + standalone Consumption Function App (API) — standalone because the scheduler needs a timer trigger, which SWA-managed functions don't support. Client ↔ API is cross-origin with bearer tokens; CORS locked to the SWA origin.
- Data: Cosmos DB — `posts` (pk `/userId`), `socialAccounts` (pk `/userId`), `oauthStates` (pk `/id`, per-item TTL). All data belongs to the single owner (`userId: 'owner'`; dev bypass uses `dev-user-001`).

## Auth model (don't regress this)

Two front doors, one session: admin **password** (scrypt hash in `ADMIN_PASSWORD_HASH`, rate-limited login) and optional **OIDC providers** (enabled per key-pair, gated by `ALLOWED_EMAILS` or first-sign-in-claims). Both mint the same HS256 session JWT (`SESSION_SECRET`); `middleware/auth.js` trusts only that token. Provider tokens never reach protected routes. `ALLOW_DEV_AUTH` dev bypass is hard-disabled in production.

## Security invariants

Maintain these when touching related code:

1. **Social OAuth tokens are encrypted at rest** — always `encryptSecret()` before storing, `decryptSecret()` only in memory at use time (`publish.js` pattern).
2. **Never return unsigned blob URLs to clients** — only short-lived SAS URLs via `toClientMediaUrl()`. (`mediaBlobUrl` on posts is the one sanctioned canonical reference.)
3. **All server-side fetches of user-influenced URLs go through `safeFetchMedia()`** (allowlist + private-IP DNS check + no redirects + timeout + size cap).
4. **OAuth callbacks are staged, never trusted**: anonymous callback endpoints only stage short-TTL single-use records; account/session creation happens in an authenticated step (`/accounts/finalize`) or via one-time grants (`/auth/redeem`). Don't collapse these into the callback.
5. **Login endpoints stay rate-limited** and give identical errors for wrong vs. empty credentials.
6. **Production fails fast** on missing `SESSION_SECRET` / admin credential (middleware startup checks).
7. Ephemeral `oauthStates` records carry a `ttl` field (Cosmos TTL); the `owner-claim` record must NOT have one.

## Gotchas

- `configure.sh` must stay **re-run safe**: it reuses existing `SESSION_SECRET` / `TOKEN_ENCRYPTION_KEY` / `ADMIN_PASSWORD_HASH` app settings. Regenerating `TOKEN_ENCRYPTION_KEY` orphans stored social tokens.
- `infra/azuredeploy.json` is compiled from `main.bicep` — regenerate after Bicep edits (CI warns on drift).
- Media URLs are HTTPS-only by design, so Azurite (HTTP) can't serve publishable media — known docker-compose limitation.
- Platform OAuth exchanges (`social/oauth.js`, `loginProviders.js`) are written to documented endpoints but **untested against live platform apps**.
- Per-platform content variants exist in the composer UI but only `content` (the shared text) is persisted/published.
- The login rate limiter is in-memory/per-instance — acceptable single-user trade-off, documented in `rateLimit.js`.

## Configuration

Everything is env-var driven and optional-by-default; the full reference is [docs/configuration.md](docs/configuration.md). Local settings live in `api/local.settings.json` (gitignored; template at `local.settings.example.json`).
