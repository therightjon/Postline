# Security Model

Postline handles OAuth tokens that can post as you on your social accounts, so security is treated as a first-class feature. This page describes the model; the full threat analysis is in [Postline-threat-model.md](../Postline-threat-model.md).

## Identity & sessions

- **Single-user instances.** Every sign-in method resolves to one owner identity. There is no signup, no user table, no password reset surface.
- **Admin password** is stored as an scrypt hash (memory-hard KDF, Node built-in; `scrypt:N:r:p:salt:hash` format). The login endpoint has per-IP rate limiting with exponential lockout. `ADMIN_PASSWORD` (plaintext app setting) is accepted for one-click deploys and hashed in memory at startup — switching to `ADMIN_PASSWORD_HASH` removes the plaintext from app settings.
- **Sessions** are short-lived HS256 JWTs signed with a per-deployment `SESSION_SECRET`. The API trusts only these; identity-provider tokens never reach protected routes.
- **OIDC sign-in** (optional) exchanges codes server-side (PKCE where supported) and is gated by `ALLOWED_EMAILS` or first-sign-in-claims. The callback stages a one-time 60-second grant — tokens never appear in URLs.
- A **local dev bypass** (`ALLOW_DEV_AUTH`) exists for zero-config development and is hard-disabled whenever the app runs in production mode or on Azure.

## Social platform tokens

- Tokens are **encrypted at rest** (AES-256-GCM, per-deployment `TOKEN_ENCRYPTION_KEY`) before they touch Cosmos DB, and decrypted only in memory at publish time. A database leak alone does not expose usable tokens.
- The account-connect flow is **forgery-resistant**: the unauthenticated platform callback only stages a pending record; an authenticated `finalize` call bound to your session creates the account. A forged callback cannot attach an account to your identity.
- OAuth `state` records are single-use, expire in 10 minutes, and carry Cosmos TTLs so they self-purge.

## Outbound request safety (SSRF)

Server-side media fetches (X/LinkedIn uploads) go through `safeFetchMedia`:
host allowlist (your blob storage + `MEDIA_ALLOWED_HOSTS`) → DNS resolution must yield public addresses (loopback/private/link-local/metadata ranges rejected) → HTTPS only, no redirects, 10s timeout, 15 MB cap. Media URLs are also validated at post create/update time, not just at publish.

## Media privacy

- The storage account disallows public blob access; the media container is private.
- Clients and platforms receive only **short-lived SAS URLs** (60/120 min). The unsigned blob URL is never returned by the API.
- Uploads are capped (10 MB default) and MIME-type allowlisted.

## Platform & transport

- `staticwebapp.config.json` sets HSTS, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy, and Permissions-Policy.
- Function App CORS is locked to the Static Web App origin. HTTPS-only, TLS 1.2 minimum, FTPS disabled (Bicep deployment).
- The scheduler bounds its per-tick batch and concurrency, so a pile-up of due posts can't cause unbounded fan-out.

## Trade-offs made deliberately

- **Connection-string secrets in app settings** (not Key Vault/Managed Identity) keep the portable, runs-anywhere baseline. Azure-only hardening with Key Vault + Managed Identity is a sensible enhancement for Azure deployments — contributions welcome.
- **In-memory login rate limiting** is per-instance. The scrypt hash is the floor defense; a multi-instance public service would need a shared store, which this deliberately is not.
- **Plaintext `ADMIN_PASSWORD` option** trades at-rest hygiene for one-click deployability; it's in the same exposure class as the connection strings stored beside it, and the docs steer you to the hash.

## Reporting

If you find a vulnerability, please open a private security advisory on GitHub rather than a public issue.
