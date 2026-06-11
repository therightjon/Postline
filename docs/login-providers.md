# Optional Login Providers

Password sign-in works out of the box with zero provider setup. If you'd rather click "Continue with Google/Microsoft/GitHub/Facebook", configure any subset below — a provider's button appears on the login page only when its keys are set.

**Access control:** Postline is a single-user instance. With `ALLOWED_EMAILS` set, only those emails may sign in via a provider. With it unset, the **first** provider sign-in claims the instance and every other identity is rejected. Either way, a stranger finding your URL cannot get in. All sign-in methods map to the same single owner — your posts and connected accounts are shared across them.

For each provider, register the redirect URI `{API_BASE_URL}/api/auth/callback/{provider}` (your Function App URL, e.g. `https://postline-api-abc123.azurewebsites.net/api/auth/callback/google`).

## Google

Variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **Create OAuth client ID** (type: Web application).
2. Configure the consent screen (External; only you will use it — no verification needed for basic email/profile scopes).
3. Add the redirect URI above.

## Microsoft (personal + work accounts)

Variables: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`

1. [Entra portal](https://entra.microsoft.com/) → App registrations → **New registration**.
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (this is what makes `common` work).
3. Add the redirect URI (platform: Web) and create a client secret.

## GitHub

Variables: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App.
2. Authorization callback URL: the redirect URI above.

This is the lowest-friction provider — no review process at all.

## Facebook

Variables: `FACEBOOK_LOGIN_APP_ID`, `FACEBOOK_LOGIN_APP_SECRET`

1. Create (or reuse) a Meta app with the **Facebook Login** product and add the redirect URI.
2. Your account must return an email (`email` permission granted).

These keys are deliberately separate from the publishing keys (`FACEBOOK_APP_ID`) so enabling publishing never silently enables Facebook login — though you may point both at the same Meta app if you wish.

## How it works (security note)

The browser never sees provider tokens. The API exchanges the code server-side (confidential client; PKCE for Google/Microsoft), asks the provider's userinfo API for your verified email, checks the allowlist, then stages a **one-time 60-second grant**; your browser redeems it for Postline's own session token. Provider identities are only used at the login moment.
