# Configuration Reference

All configuration is via environment variables — app settings on Azure, `api/local.settings.json` locally, `environment:` blocks in docker-compose. **Everything is optional except the core section**: features activate when their keys are present.

## Core (required in production)

| Variable | Description |
|---|---|
| `ADMIN_PASSWORD_HASH` | scrypt hash of the admin sign-in password. Generate: `node scripts/hash-password.mjs --generate` (or pass your own password as the argument). Preferred over `ADMIN_PASSWORD`. |
| `ADMIN_PASSWORD` | Plaintext fallback accepted so template deploys work one-click; hashed in memory at startup. Switch to `ADMIN_PASSWORD_HASH` when convenient and remove this. |
| `SESSION_SECRET` | Signs session JWTs. At least 32 characters; `openssl rand -base64 32`. Rotating it signs everyone out (which is just you). |
| `TOKEN_ENCRYPTION_KEY` | base64 of exactly 32 bytes; encrypts social OAuth tokens at rest (AES-256-GCM). `openssl rand -base64 32`. **Rotating it orphans already-encrypted tokens** — you'd reconnect your social accounts. |
| `COSMOS_ENDPOINT` / `COSMOS_KEY` / `COSMOS_DATABASE` | Cosmos DB connection. Database defaults to `postline`. |
| `BLOB_CONNECTION_STRING` / `BLOB_CONTAINER` | Blob Storage for media. Container defaults to `media`. |
| `APP_BASE_URL` / `API_BASE_URL` | Public origins of the frontend and the API (used for OAuth redirects and CORS-sensitive URLs). |

## Sessions & sign-in behavior

| Variable | Default | Description |
|---|---|---|
| `SESSION_TTL_HOURS` | `12` | Session token lifetime. |
| `ALLOWED_EMAILS` | *(empty)* | Comma-separated emails allowed to sign in via OIDC providers. Empty = the **first** OIDC sign-in claims the instance and becomes the only allowed identity. |
| `ALLOW_DEV_AUTH` | *(off)* | `true` enables the local dev-bypass token. Hard-disabled in production (`NODE_ENV=production` or running on Azure). |
| `DEV_AUTH_TOKEN` | `dev-token` | The dev-bypass token value. |

## OIDC login providers (each optional)

A provider's sign-in button appears only when both its values are set.

| Provider | Variables | Redirect URI to register |
|---|---|---|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `{API_BASE_URL}/api/auth/callback/google` |
| Microsoft | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | `{API_BASE_URL}/api/auth/callback/microsoft` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `{API_BASE_URL}/api/auth/callback/github` |
| Facebook | `FACEBOOK_LOGIN_APP_ID`, `FACEBOOK_LOGIN_APP_SECRET` | `{API_BASE_URL}/api/auth/callback/facebook` |

See [login-providers.md](login-providers.md) for app-creation walkthroughs. Facebook *login* keys are deliberately separate from Facebook *publishing* keys.

## Social publishing platforms (each optional)

| Platform | Variables | OAuth callback to register |
|---|---|---|
| Facebook + Instagram | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | `{API_BASE_URL}/api/accounts/callback/facebook` and `/instagram` |
| X (Twitter) | `TWITTER_API_KEY`, `TWITTER_API_SECRET` | `{API_BASE_URL}/api/accounts/callback/twitter` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | `{API_BASE_URL}/api/accounts/callback/linkedin` |

See [platform-publishing.md](platform-publishing.md) for scopes and app review notes.

## Media & security tuning (sane defaults)

| Variable | Default | Description |
|---|---|---|
| `MAX_MEDIA_BYTES` | `10485760` (10 MB) | Upload size cap. |
| `ALLOWED_MEDIA_TYPES` | jpeg, png, webp, gif, mp4 | Allowed upload MIME types (comma-separated). |
| `MEDIA_ALLOWED_HOSTS` | managed blob host | Extra hosts allowed as media sources (SSRF allowlist). |
| `MEDIA_SAS_TTL_MINUTES` | `60` | Lifetime of signed media-read URLs served to the client. |
| `PUBLISH_MEDIA_SAS_TTL_MINUTES` | `120` | Lifetime of signed URLs handed to platforms at publish time. |
| `MEDIA_FETCH_TIMEOUT_MS` | `10000` | Timeout for server-side media fetches (X/LinkedIn upload). |
| `MEDIA_FETCH_MAX_BYTES` | `15728640` (15 MB) | Response-size cap for server-side media fetches. |
| `OAUTH_STATE_TTL_MS` | `600000` (10 min) | Lifetime of OAuth state records. |
| `SCHEDULER_BATCH_SIZE` | `100` | Max due posts published per scheduler tick. |
| `SCHEDULER_CONCURRENCY` | `5` | Parallel publishes within a tick. |

## Client build variables (Vite, set at build time)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | API base URL. The deploy script/workflow sets this to the Function App URL. |
| `VITE_PROXY_TARGET` | `http://localhost:7071` | Dev-server proxy target (docker-compose sets this to the api container). |

## Misc

| Variable | Default | Description |
|---|---|---|
| `COSMOS_AUTO_INIT` | *(off)* | `true` creates the database/containers on first use (docker-compose/emulator convenience). Provisioned deployments don't need it. |
| `FACEBOOK_GRAPH_VERSION` | `v19.0` | Meta Graph API version used by publishing and Facebook login. |
