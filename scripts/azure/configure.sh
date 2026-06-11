#!/usr/bin/env bash
set -euo pipefail

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI (az) is required." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (used to hash the admin password)." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required (used to generate secrets)." >&2
  exit 1
fi

: "${RG:?Set RG to your resource group name}"
: "${SWA_NAME:?Set SWA_NAME to your Static Web App name}"
: "${FUNC_NAME:?Set FUNC_NAME to your Function App name}"
: "${COSMOS_NAME:?Set COSMOS_NAME to your Cosmos DB account name}"
: "${STORAGE_NAME:?Set STORAGE_NAME to your storage account name}"

ENV_FILE="${ENV_FILE:-.azure-postline.env}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Social platform keys — all optional; a platform is enabled by providing its keys.
FACEBOOK_APP_ID="${FACEBOOK_APP_ID:-}"
FACEBOOK_APP_SECRET="${FACEBOOK_APP_SECRET:-}"
TWITTER_API_KEY="${TWITTER_API_KEY:-}"
TWITTER_API_SECRET="${TWITTER_API_SECRET:-}"
LINKEDIN_CLIENT_ID="${LINKEDIN_CLIENT_ID:-}"
LINKEDIN_CLIENT_SECRET="${LINKEDIN_CLIENT_SECRET:-}"

# OIDC login provider keys — all optional; a sign-in button appears only when
# a provider's keys are set. ALLOWED_EMAILS gates who may sign in (otherwise
# the first sign-in claims the instance).
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
MICROSOFT_CLIENT_ID="${MICROSOFT_CLIENT_ID:-}"
MICROSOFT_CLIENT_SECRET="${MICROSOFT_CLIENT_SECRET:-}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-}"
GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-}"
FACEBOOK_LOGIN_APP_ID="${FACEBOOK_LOGIN_APP_ID:-}"
FACEBOOK_LOGIN_APP_SECRET="${FACEBOOK_LOGIN_APP_SECRET:-}"
ALLOWED_EMAILS="${ALLOWED_EMAILS:-}"

MEDIA_ALLOWED_HOSTS="${MEDIA_ALLOWED_HOSTS:-${STORAGE_NAME}.blob.core.windows.net}"
MEDIA_SAS_TTL_MINUTES="${MEDIA_SAS_TTL_MINUTES:-60}"
PUBLISH_MEDIA_SAS_TTL_MINUTES="${PUBLISH_MEDIA_SAS_TTL_MINUTES:-120}"
MAX_MEDIA_BYTES="${MAX_MEDIA_BYTES:-10485760}"
ALLOWED_MEDIA_TYPES="${ALLOWED_MEDIA_TYPES:-image/jpeg,image/png,image/webp,image/gif,video/mp4}"
OAUTH_STATE_TTL_MS="${OAUTH_STATE_TTL_MS:-600000}"
SESSION_TTL_HOURS="${SESSION_TTL_HOURS:-12}"

FUNC_HOST="$(az functionapp show -n "$FUNC_NAME" -g "$RG" --query defaultHostName -o tsv)"
SWA_HOST="$(az staticwebapp show -n "$SWA_NAME" -g "$RG" --query defaultHostname -o tsv)"
COSMOS_ENDPOINT="$(az cosmosdb show -n "$COSMOS_NAME" -g "$RG" --query documentEndpoint -o tsv)"
COSMOS_KEY="$(az cosmosdb keys list -n "$COSMOS_NAME" -g "$RG" --query primaryMasterKey -o tsv)"
BLOB_CONN="$(az storage account show-connection-string -n "$STORAGE_NAME" -g "$RG" --query connectionString -o tsv)"

APP_BASE_URL="https://${SWA_HOST}"
API_BASE_URL="https://${FUNC_HOST}"

# Reuse an existing app setting if present so re-running this script never
# invalidates sessions (SESSION_SECRET) or — critically — makes previously
# encrypted social tokens undecryptable (TOKEN_ENCRYPTION_KEY).
get_existing_setting() {
  az functionapp config appsettings list -n "$FUNC_NAME" -g "$RG" \
    --query "[?name=='$1'].value | [0]" -o tsv 2>/dev/null || true
}

SESSION_SECRET="${SESSION_SECRET:-$(get_existing_setting SESSION_SECRET)}"
if [[ -z "$SESSION_SECRET" ]]; then
  SESSION_SECRET="$(openssl rand -base64 32)"
  echo "Generated new SESSION_SECRET."
fi

TOKEN_ENCRYPTION_KEY="${TOKEN_ENCRYPTION_KEY:-$(get_existing_setting TOKEN_ENCRYPTION_KEY)}"
if [[ -z "$TOKEN_ENCRYPTION_KEY" ]]; then
  TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)"
  echo "Generated new TOKEN_ENCRYPTION_KEY."
fi

# Admin password: keep an existing hash unless the caller supplies a new
# password (ADMIN_PASSWORD) or hash (ADMIN_PASSWORD_HASH).
GENERATED_PASSWORD=""
ADMIN_PASSWORD_HASH="${ADMIN_PASSWORD_HASH:-}"
if [[ -z "$ADMIN_PASSWORD_HASH" && -n "${ADMIN_PASSWORD:-}" ]]; then
  ADMIN_PASSWORD_HASH="$(node "$REPO_ROOT/scripts/hash-password.mjs" "$ADMIN_PASSWORD")"
fi
if [[ -z "$ADMIN_PASSWORD_HASH" ]]; then
  ADMIN_PASSWORD_HASH="$(get_existing_setting ADMIN_PASSWORD_HASH)"
fi
if [[ -z "$ADMIN_PASSWORD_HASH" ]]; then
  GENERATED_PASSWORD="$(openssl rand -base64 18 | tr '+/' '-_')"
  ADMIN_PASSWORD_HASH="$(node "$REPO_ROOT/scripts/hash-password.mjs" "$GENERATED_PASSWORD")"
fi

az functionapp config appsettings set -n "$FUNC_NAME" -g "$RG" --settings \
  NODE_ENV=production \
  COSMOS_ENDPOINT="$COSMOS_ENDPOINT" \
  COSMOS_KEY="$COSMOS_KEY" \
  COSMOS_DATABASE=postline \
  BLOB_CONNECTION_STRING="$BLOB_CONN" \
  BLOB_CONTAINER=media \
  ADMIN_PASSWORD_HASH="$ADMIN_PASSWORD_HASH" \
  SESSION_SECRET="$SESSION_SECRET" \
  SESSION_TTL_HOURS="$SESSION_TTL_HOURS" \
  TOKEN_ENCRYPTION_KEY="$TOKEN_ENCRYPTION_KEY" \
  APP_BASE_URL="$APP_BASE_URL" \
  API_BASE_URL="$API_BASE_URL" \
  MEDIA_ALLOWED_HOSTS="$MEDIA_ALLOWED_HOSTS" \
  MEDIA_SAS_TTL_MINUTES="$MEDIA_SAS_TTL_MINUTES" \
  PUBLISH_MEDIA_SAS_TTL_MINUTES="$PUBLISH_MEDIA_SAS_TTL_MINUTES" \
  MAX_MEDIA_BYTES="$MAX_MEDIA_BYTES" \
  ALLOWED_MEDIA_TYPES="$ALLOWED_MEDIA_TYPES" \
  OAUTH_STATE_TTL_MS="$OAUTH_STATE_TTL_MS" \
  FACEBOOK_APP_ID="$FACEBOOK_APP_ID" FACEBOOK_APP_SECRET="$FACEBOOK_APP_SECRET" \
  TWITTER_API_KEY="$TWITTER_API_KEY" TWITTER_API_SECRET="$TWITTER_API_SECRET" \
  LINKEDIN_CLIENT_ID="$LINKEDIN_CLIENT_ID" LINKEDIN_CLIENT_SECRET="$LINKEDIN_CLIENT_SECRET" \
  GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
  MICROSOFT_CLIENT_ID="$MICROSOFT_CLIENT_ID" MICROSOFT_CLIENT_SECRET="$MICROSOFT_CLIENT_SECRET" \
  GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" GITHUB_CLIENT_SECRET="$GITHUB_CLIENT_SECRET" \
  FACEBOOK_LOGIN_APP_ID="$FACEBOOK_LOGIN_APP_ID" FACEBOOK_LOGIN_APP_SECRET="$FACEBOOK_LOGIN_APP_SECRET" \
  ALLOWED_EMAILS="$ALLOWED_EMAILS" >/dev/null

az functionapp cors add -n "$FUNC_NAME" -g "$RG" --allowed-origins "$APP_BASE_URL" >/dev/null

cat > "$ENV_FILE" <<SETTINGS
RG=$RG
SWA_NAME=$SWA_NAME
FUNC_NAME=$FUNC_NAME
COSMOS_NAME=$COSMOS_NAME
STORAGE_NAME=$STORAGE_NAME
SWA_HOST=$SWA_HOST
FUNC_HOST=$FUNC_HOST
SETTINGS

cat <<SUMMARY

Configuration complete.

Wrote deployment context to $ENV_FILE.
SUMMARY

if [[ -n "$GENERATED_PASSWORD" ]]; then
  cat <<SUMMARY

============================================================
 Your admin sign-in password (shown ONLY this once):

   $GENERATED_PASSWORD

 Save it now. To change it later, re-run with
 ADMIN_PASSWORD="new-password" set in the environment.
============================================================
SUMMARY
fi

cat <<SUMMARY

Next step:
  source "$ENV_FILE"
  scripts/azure/deploy.sh

Callback base URLs:
  App: $APP_BASE_URL
  API: $API_BASE_URL
SUMMARY
