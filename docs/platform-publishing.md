# Publishing Platform Setup

Each platform is optional — Postline enables a platform when its keys are configured. **Obtaining the keys is the slow part**: Meta and LinkedIn gate posting permissions behind app review processes that can take days and require a privacy policy URL. Start with the platform you care about most.

In all cases, register the OAuth callback URL shown and put the keys in the Function App's app settings (or `api/local.settings.json` locally).

## Facebook + Instagram (one Meta app)

Variables: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
Callbacks: `{API_BASE_URL}/api/accounts/callback/facebook` and `.../instagram`

1. Create an app at [developers.facebook.com](https://developers.facebook.com/) (type: Business).
2. Add **Facebook Login** and configure the callback URLs above as Valid OAuth Redirect URIs.
3. Request permissions via App Review: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, and for Instagram `instagram_basic`, `instagram_content_publish`. Business verification may be required.
4. Instagram needs an **Instagram Business/Creator account linked to a Facebook Page** — Postline discovers the linked account automatically when you connect.

Notes:
- Facebook posting targets your **Page** (Postline picks your first Page with publish access).
- Instagram requires an image on every post; text-only posts fail by API design.
- Tokens: Postline exchanges for a long-lived token; Page tokens effectively don't expire.

## X (Twitter)

Variables: `TWITTER_API_KEY`, `TWITTER_API_SECRET`
Callback: `{API_BASE_URL}/api/accounts/callback/twitter`

1. Create a Project + App at [developer.x.com](https://developer.x.com/).
2. Enable **OAuth 2.0** (confidential client / web app), set the callback URL.
3. Scopes used: `tweet.read tweet.write users.read offline.access`.

Notes:
- **Free tier allows ~1,500 posts/month** and constrained rate limits; heavier use requires a paid tier.
- Access tokens expire after ~2 hours; Postline refreshes them automatically before publishing (this is why `offline.access` is required).
- Text is truncated to 280 characters server-side. Media upload uses the non-chunked v1.1 endpoint — fine for images; large videos are not supported yet.

## LinkedIn

Variables: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
Callback: `{API_BASE_URL}/api/accounts/callback/linkedin`

1. Create an app at [developer.linkedin.com](https://developer.linkedin.com/).
2. Add the **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn** products.
3. Scopes used: `openid profile w_member_social`.

Notes:
- Posts go to your personal profile (UGC Posts API), visibility PUBLIC.
- Tokens last ~60 days and LinkedIn does not grant refresh tokens to standard apps — when publishing starts failing with an auth error, reconnect the account from the Accounts page.

## How connections work (security note)

Connecting an account is a two-step, forgery-resistant flow: the platform's OAuth callback only *stages* the connection; your authenticated browser session then finalizes it, which is when Postline exchanges the code, fetches the platform identifiers it needs (Page ID, Instagram account ID, LinkedIn member URN), **encrypts the tokens (AES-256-GCM)**, and stores the account. Disconnecting deletes the stored record.

> **Status caveat:** the OAuth exchanges are implemented against each platform's documented endpoints but have not yet been exercised against live platform apps. If you hit a platform quirk, please open an issue with the error text from the Accounts page.
