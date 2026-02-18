# Postline

**Social Media Management App** — Create, preview, schedule, and publish posts to Instagram, Facebook, X (Twitter), and LinkedIn from one place.

## Architecture

| Component | Azure Service | Tier |
|-----------|--------------|------|
| Frontend | Azure Static Web Apps | Free (always) |
| Backend API + Scheduler | Azure Functions (Consumption, Linux, Node 20) | Pay-per-use (typically within free grant for low usage) |
| Database | Azure Cosmos DB NoSQL | Free Tier (one account per subscription) |
| Media + Function Host Storage | Azure Storage Account (StorageV2) | Free (5GB, 12 months) + standard rates after trial |
| Authentication | Azure AD B2C (existing tenant) | Free tier available |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) v4
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Azure Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/) (`npm i -g @azure/static-web-apps-cli`) — only needed for production deploys

## Local Development

### 1. Install dependencies

```bash
cd client && npm install
cd ../api && npm install
```

### 2. Configure environment variables

Edit `api/local.settings.json` with your Azure service credentials:

```json
{
  "Values": {
    "COSMOS_ENDPOINT": "https://your-cosmos.documents.azure.com:443/",
    "COSMOS_KEY": "your-cosmos-key",
    "COSMOS_DATABASE": "postline",
    "BLOB_CONNECTION_STRING": "your-blob-connection-string",
    "BLOB_CONTAINER": "media",
    "B2C_TENANT_NAME": "your-tenant",
    "B2C_CLIENT_ID": "your-client-id",
    "B2C_POLICY_NAME": "B2C_1_signupsignin",
    "APP_BASE_URL": "http://localhost:5173",
    "API_BASE_URL": "http://localhost:7071",
    "FACEBOOK_APP_ID": "",
    "FACEBOOK_APP_SECRET": "",
    "TWITTER_API_KEY": "",
    "TWITTER_API_SECRET": "",
    "TWITTER_BEARER_TOKEN": "",
    "LINKEDIN_CLIENT_ID": "",
    "LINKEDIN_CLIENT_SECRET": ""
  }
}
```

Create a `client/.env` file for frontend auth config:

```env
VITE_B2C_TENANT_NAME=your-tenant
VITE_B2C_CLIENT_ID=your-client-id
VITE_B2C_POLICY_NAME=B2C_1_signupsignin
VITE_API_BASE_URL=http://localhost:7071/api
```

> **Dev mode (no B2C required):** If `VITE_B2C_CLIENT_ID` is not set, the app automatically enables a local dev bypass — authentication is mocked with a `dev@postline.app` user and no Azure AD B2C tenant is needed. The dashboard also displays demo post data when the API is not reachable.

### 3. Run locally

If `VITE_API_BASE_URL` is not set, the Vite dev server proxies `/api/*` requests to `http://localhost:7071`.

```bash
# Terminal 1 — start the Azure Functions API
cd api && func start

# Terminal 2 — start the React frontend
cd client && npm run dev
```

The app will be available at `http://localhost:5173`.

## API Reference

All endpoints require a valid Azure AD B2C bearer token in the `Authorization` header (bypassed automatically in dev mode).

### Posts

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/posts` | List posts; optional `?status=draft\|scheduled\|published\|failed\|all` |
| `GET` | `/api/posts/{id}` | Get a single post |
| `POST` | `/api/posts` | Create a post (`draft` or `scheduled`) |
| `PUT` | `/api/posts/{id}` | Update a post |
| `DELETE` | `/api/posts/{id}` | Delete a post |
| `POST` | `/api/posts/{id}/publish` | Immediately publish a post to all selected platforms |

**Post schema:** `id`, `userId`, `content`, `platforms[]`, `mediaUrl`, `status` (`draft` | `scheduled` | `published` | `failed`), `scheduledAt`, `publishedAt`, `publishResults`, `error`, `createdAt`, `updatedAt`

### Media

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/media` | Upload an image/video file (multipart form); returns `{ url, name, size }` |

Uploaded files are stored in Azure Blob Storage in the `media` container with public blob access.

### Social Accounts

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/accounts` | List connected social accounts |
| `GET` | `/api/accounts/connect/{platform}` | Get the OAuth authorization URL for a platform |
| `GET\|POST` | `/api/accounts/callback/{platform}` | OAuth redirect callback — stores the connected account |
| `DELETE` | `/api/accounts/{id}` | Disconnect an account |

Supported `platform` values: `facebook`, `instagram`, `twitter`, `linkedin`

## Scheduler

A Timer Trigger function (`scheduler`) runs **every minute** (`0 */1 * * * *`) and publishes any posts whose `status` is `scheduled` and `scheduledAt <= now`. Per-platform results (success/failure) are written back to the post document.

## Cosmos DB

**Database:** `postline`

| Container | Partition Key | Contents |
|-----------|--------------|----------|
| `posts` | `/userId` | User posts in all statuses |
| `socialAccounts` | `/userId` | Connected OAuth accounts per user |

## Social Media API Setup

### Facebook & Instagram

1. Create a [Meta Developer App](https://developers.facebook.com/)
2. Add the **Facebook Login** and **Instagram Graph API** products
3. Request permissions: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `pages_show_list`
4. Set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` in `local.settings.json`

> **Note:** Instagram only supports posts that include an image. Text-only Instagram posts will be rejected by the API.

### X (Twitter)

1. Sign up at [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a Project and App with **OAuth 2.0** enabled
3. Required scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
4. Free tier: up to 1,500 tweets/month
5. Set `TWITTER_API_KEY`, `TWITTER_API_SECRET`, and `TWITTER_BEARER_TOKEN` in `local.settings.json`

> **Note:** Tweet content is automatically truncated to 280 characters server-side.

### LinkedIn

1. Apply for [LinkedIn Marketing Developer Platform](https://developer.linkedin.com/) access
2. Create an app with `w_member_social` and `r_liteprofile` scopes
3. Posts are published via the UGC Posts API (`POST /v2/ugcPosts`)
4. Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in `local.settings.json`

## Deploy to Azure

This repository deploys with a **two-host model**:
- **Static Web App (Free)** for frontend hosting
- **Standalone Function App** for API + timer trigger scheduler

SWA Free does not support bring-your-own Functions, and SWA-managed APIs only support HTTP triggers, so the scheduler must run in a separate Function App.

### 1. Provision resources (East US / East US2 defaults)

```bash
export SUBSCRIPTION_ID="<your-subscription-id>"
export SUFFIX="<globally-unique-suffix>" # lowercase letters/numbers

scripts/azure/provision.sh
```

### 2. Configure app settings and CORS

```bash
export RG="rg-postline-eastus"
export SWA_NAME="postline-web-$SUFFIX"
export FUNC_NAME="postline-api-$SUFFIX"
export COSMOS_NAME="postline-cosmos-$SUFFIX"
export STORAGE_NAME="postlinest$SUFFIX"

export B2C_TENANT_NAME="<your-b2c-tenant>"
export B2C_CLIENT_ID="<your-b2c-client-id>"
export B2C_POLICY_NAME="B2C_1_signupsignin"

# Optional until each connector is enabled
export FACEBOOK_APP_ID=""
export FACEBOOK_APP_SECRET=""
export TWITTER_API_KEY=""
export TWITTER_API_SECRET=""
export TWITTER_BEARER_TOKEN=""
export LINKEDIN_CLIENT_ID=""
export LINKEDIN_CLIENT_SECRET=""

scripts/azure/configure.sh
```

### 3. Deploy backend and frontend

```bash
source .azure-postline.env
scripts/azure/deploy.sh
```

### 4. Configure identity providers

1. Configure B2C app registration redirects:
   - `https://<swa-host>/`
2. Configure social platform callbacks (when you enable each one):
   - `https://<func-host>/api/accounts/callback/facebook`
   - `https://<func-host>/api/accounts/callback/instagram`
   - `https://<func-host>/api/accounts/callback/twitter`
   - `https://<func-host>/api/accounts/callback/linkedin`

## Project Structure

```
Postline/
├── client/                         # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── composer/           # PlatformSelector, MediaUpload, SchedulePicker, CharacterCount
│   │   │   ├── dashboard/          # PostCard
│   │   │   ├── layout/             # AppShell, Sidebar, ThemeToggle
│   │   │   └── preview/            # Per-platform live previews (Facebook, Instagram, LinkedIn, X)
│   │   ├── pages/                  # Dashboard, Compose (/compose, /compose/:id), Calendar, Accounts, Login
│   │   ├── services/               # axios API client (api.js), MSAL auth config (authConfig.js)
│   │   ├── context/                # AuthContext — MSAL wrapper with dev-mode bypass
│   │   └── App.jsx                 # Root router with protected routes
│   ├── vite.config.js              # Vite config (proxies /api → localhost:7071 in dev)
│   └── package.json
├── api/                            # Azure Functions (Node.js v4, ESM)
│   ├── src/
│   │   ├── functions/
│   │   │   ├── posts.js            # CRUD + publish HTTP triggers
│   │   │   ├── media.js            # Media upload HTTP trigger
│   │   │   ├── accounts.js         # OAuth connect/callback/disconnect HTTP triggers
│   │   │   ├── publish.js          # Cross-platform publish logic (shared + HTTP trigger)
│   │   │   └── scheduler.js        # Timer trigger — publishes due scheduled posts every minute
│   │   ├── services/
│   │   │   ├── cosmos.js           # Cosmos DB singleton client + CRUD helpers
│   │   │   ├── blob.js             # Blob Storage upload/delete helpers
│   │   │   └── social/             # Platform publishers: facebook.js, instagram.js, twitter.js, linkedin.js
│   │   └── middleware/
│   │       └── auth.js             # B2C JWT validation via jwks-rsa
│   ├── host.json                   # Functions host config (extension bundle 4.x)
│   └── local.settings.json         # Local environment variable template
├── scripts/azure/                  # Azure provisioning/config/deploy scripts
│   ├── provision.sh
│   ├── configure.sh
│   └── deploy.sh
├── staticwebapp.config.json        # SWA routing: SPA fallback config
└── README.md
```

## License

MIT
