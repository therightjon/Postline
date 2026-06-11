# API Reference

Base URL: `{API_BASE_URL}/api`. All endpoints except `auth/*` and the OAuth callbacks require `Authorization: Bearer <session-token>`.

## Auth

| Method | Route | Description |
|---|---|---|
| `GET` | `/auth/providers` | Which sign-in methods this deployment supports: `{ password, devBypass, oidc: [{id, name}] }`. Drives the login page. |
| `POST` | `/auth/login` | `{ password }` → `{ token, user }`. Rate-limited per IP (429 + `Retry-After` when locked out). |
| `GET` | `/auth/login/{provider}` | Starts an OIDC sign-in (302 to the provider). Providers: `google`, `microsoft`, `github`, `facebook`. |
| `GET` | `/auth/callback/{provider}` | Provider redirect target. On success redirects to `/login?grant=<one-time-id>`; on failure `/login?error=<code>`. |
| `POST` | `/auth/redeem` | `{ grantId }` → `{ token, user }`. Grants are single-use and expire in 60s. |
| `GET` | `/auth/me` | Returns `{ user }` for the current session. |

Sessions are HS256 JWTs (default lifetime 12h). There is no server-side logout; the client discards the token.

## Posts

| Method | Route | Description |
|---|---|---|
| `GET` | `/posts` | List posts; optional `?status=draft\|scheduled\|published\|failed\|all`. |
| `GET` | `/posts/{id}` | Get a single post. |
| `POST` | `/posts` | Create (`status`: `draft` or `scheduled`; `scheduledAt` required when scheduled). |
| `PUT` | `/posts/{id}` | Partial update (same validation as create). |
| `DELETE` | `/posts/{id}` | Delete. |
| `POST` | `/posts/{id}/publish` | Publish immediately to all selected platforms; returns per-platform results. |

**Post fields:** `id`, `userId`, `content`, `platforms[]` (`facebook|instagram|twitter|linkedin`), `mediaUrl` (signed, short-lived), `mediaBlobUrl` (canonical, persist this when editing), `status`, `scheduledAt`, `publishedAt`, `publishResults` (per-platform `{success, platformPostId?, error?}`), `error`, `createdAt`, `updatedAt`.

`mediaUrl` on write accepts only HTTPS URLs whose host is your managed blob storage or in `MEDIA_ALLOWED_HOSTS`.

## Media

| Method | Route | Description |
|---|---|---|
| `POST` | `/media` | Multipart upload (`file` field) → `{ url, name, size, contentType }`. `url` is a short-lived signed read URL. Type/size limits per configuration. |

## Social accounts

| Method | Route | Description |
|---|---|---|
| `GET` | `/accounts` | List connected accounts (`id`, `platform`, `platformName`, `platformUsername`, `connectedAt` — tokens are never returned). |
| `GET` | `/accounts/connect/{platform}` | → `{ authUrl }`. Redirect the browser there to start connecting. |
| `GET` | `/accounts/callback/{platform}` | Platform redirect target (unauthenticated). Stages the connection and redirects to `/accounts?finalize=<id>`. |
| `POST` | `/accounts/finalize` | `{ finalizeId }` — authenticated completion: exchanges the code, encrypts and stores tokens. Returns the safe account fields. |
| `DELETE` | `/accounts/{id}` | Disconnect (deletes the stored record). |

## Scheduler

A timer trigger runs every minute and publishes posts with `status=scheduled` and `scheduledAt <= now` (oldest first, bounded batch/concurrency). Results are written back to each post; a post with any platform failure is marked `failed` with per-platform detail in `publishResults`.

## Data model (Cosmos DB)

| Container | Partition key | Contents |
|---|---|---|
| `posts` | `/userId` | Posts in all statuses. |
| `socialAccounts` | `/userId` | Connected accounts; tokens encrypted (AES-256-GCM). |
| `oauthStates` | `/id` | Ephemeral OAuth states/grants (Cosmos TTL auto-purge) + the persistent owner-claim record. |
