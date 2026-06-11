# Deploying to Azure

Postline runs on free/cheap Azure tiers: Static Web Apps **Free** (frontend), Functions **Consumption** (API + scheduler), Cosmos DB **free tier**, and a Standard_LRS storage account. Typical monthly cost for one user: **$0–3**.

Two-host model: SWA Free can't run timer triggers, and the scheduler needs one — so the API is a standalone Function App and the client talks to it cross-origin with bearer tokens (CORS locked to your SWA origin).

## Option A — Deploy-to-Azure button (infrastructure) + workflow (code)

1. Click the **Deploy to Azure** button in the README. The template ([infra/main.bicep](../infra/main.bicep)) provisions everything and asks for:
   - `adminPassword` — your sign-in password (min 12 chars; use a long random one)
   - optional `allowedEmails` and `alertEmail`
   - `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` are generated automatically per deployment.
2. Deploy the code. Either:
   - **GitHub Actions** (fork the repo): add the secrets/variables listed at the top of [.github/workflows/deploy.yml](../.github/workflows/deploy.yml), then run the **Deploy** workflow; or
   - **Local scripts**: `export RG=… SWA_NAME=… FUNC_NAME=…` (from the template outputs) and run `scripts/azure/deploy.sh`.
3. Open the Static Web App URL and sign in with your password.
4. Add platform keys whenever you want them ([publishing](platform-publishing.md), [login providers](login-providers.md)) — update the Function App's app settings and register the callback URLs.

> After first deploy, consider replacing the `ADMIN_PASSWORD` app setting with `ADMIN_PASSWORD_HASH` (`node scripts/hash-password.mjs "your-password"`) so the plaintext isn't stored in app settings.

## Option B — Shell scripts end to end

```bash
# 1. Provision (storage, Cosmos, Function App, SWA)
export SUBSCRIPTION_ID="<subscription-id>"
export SUFFIX="<globally-unique-lowercase-suffix>"
scripts/azure/provision.sh

# 2. Configure app settings + CORS (generates SESSION_SECRET,
#    TOKEN_ENCRYPTION_KEY, and an admin password — printed once)
export RG="rg-postline-eastus"
export SWA_NAME="postline-web-$SUFFIX"
export FUNC_NAME="postline-api-$SUFFIX"
export COSMOS_NAME="postline-cosmos-$SUFFIX"
export STORAGE_NAME="postlinest$SUFFIX"
# optional: ADMIN_PASSWORD="choose-your-own"   # otherwise generated
# optional: platform keys (see docs/configuration.md)
scripts/azure/configure.sh

# 3. Deploy code (Functions Core Tools + SWA CLI required)
source .azure-postline.env
scripts/azure/deploy.sh
```

`configure.sh` is safe to re-run: it reuses existing `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `ADMIN_PASSWORD_HASH` app settings rather than regenerating them (regenerating the encryption key would orphan stored social tokens).

## Keeping the ARM template in sync

`infra/azuredeploy.json` is compiled from `infra/main.bicep`:

```bash
az bicep build --file infra/main.bicep --outfile infra/azuredeploy.json
```

CI warns when they drift.

## Monitoring

The template wires Application Insights automatically. If you set `alertEmail`, you also get an alert when the API returns sustained HTTP 5xx errors (a publish pipeline or configuration problem). Scheduler activity is visible in the Function App's **Logs** / App Insights traces.

## Cost notes

| Resource | Tier | Expected cost (single user) |
|---|---|---|
| Static Web App | Free | $0 |
| Function App | Consumption | $0 (within the monthly free grant) |
| Cosmos DB | Free tier (1000 RU/s, 25 GB) | $0 — free tier is per-subscription, one account |
| Storage | Standard_LRS | ~$0–1 |
| App Insights / Log Analytics | Pay-as-you-go | ~$0 at this volume (sampling on) |

If your subscription's Cosmos free tier is already taken, pass `cosmosFreeTier=false` to the template; the 400 RU/s database then bills (~$24/mo) — or switch the account to serverless.
