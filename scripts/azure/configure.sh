#!/usr/bin/env bash
set -euo pipefail

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI (az) is required." >&2
  exit 1
fi

: "${RG:?Set RG to your resource group name}"
: "${SWA_NAME:?Set SWA_NAME to your Static Web App name}"
: "${FUNC_NAME:?Set FUNC_NAME to your Function App name}"
: "${COSMOS_NAME:?Set COSMOS_NAME to your Cosmos DB account name}"
: "${STORAGE_NAME:?Set STORAGE_NAME to your storage account name}"
: "${B2C_TENANT_NAME:?Set B2C_TENANT_NAME to your B2C tenant name}"
: "${B2C_CLIENT_ID:?Set B2C_CLIENT_ID to your B2C app client id}"

B2C_POLICY_NAME="${B2C_POLICY_NAME:-B2C_1_signupsignin}"
ENV_FILE="${ENV_FILE:-.azure-postline.env}"

FACEBOOK_APP_ID="${FACEBOOK_APP_ID:-}"
FACEBOOK_APP_SECRET="${FACEBOOK_APP_SECRET:-}"
TWITTER_API_KEY="${TWITTER_API_KEY:-}"
TWITTER_API_SECRET="${TWITTER_API_SECRET:-}"
TWITTER_BEARER_TOKEN="${TWITTER_BEARER_TOKEN:-}"
LINKEDIN_CLIENT_ID="${LINKEDIN_CLIENT_ID:-}"
LINKEDIN_CLIENT_SECRET="${LINKEDIN_CLIENT_SECRET:-}"

FUNC_HOST="$(az functionapp show -n "$FUNC_NAME" -g "$RG" --query defaultHostName -o tsv)"
SWA_HOST="$(az staticwebapp show -n "$SWA_NAME" -g "$RG" --query defaultHostname -o tsv)"
COSMOS_ENDPOINT="$(az cosmosdb show -n "$COSMOS_NAME" -g "$RG" --query documentEndpoint -o tsv)"
COSMOS_KEY="$(az cosmosdb keys list -n "$COSMOS_NAME" -g "$RG" --query primaryMasterKey -o tsv)"
BLOB_CONN="$(az storage account show-connection-string -n "$STORAGE_NAME" -g "$RG" --query connectionString -o tsv)"

APP_BASE_URL="https://${SWA_HOST}"
API_BASE_URL="https://${FUNC_HOST}"

az functionapp config appsettings set -n "$FUNC_NAME" -g "$RG" --settings \
  NODE_ENV=production \
  COSMOS_ENDPOINT="$COSMOS_ENDPOINT" \
  COSMOS_KEY="$COSMOS_KEY" \
  COSMOS_DATABASE=postline \
  BLOB_CONNECTION_STRING="$BLOB_CONN" \
  BLOB_CONTAINER=media \
  B2C_TENANT_NAME="$B2C_TENANT_NAME" \
  B2C_CLIENT_ID="$B2C_CLIENT_ID" \
  B2C_POLICY_NAME="$B2C_POLICY_NAME" \
  APP_BASE_URL="$APP_BASE_URL" \
  API_BASE_URL="$API_BASE_URL" \
  FACEBOOK_APP_ID="$FACEBOOK_APP_ID" FACEBOOK_APP_SECRET="$FACEBOOK_APP_SECRET" \
  TWITTER_API_KEY="$TWITTER_API_KEY" TWITTER_API_SECRET="$TWITTER_API_SECRET" TWITTER_BEARER_TOKEN="$TWITTER_BEARER_TOKEN" \
  LINKEDIN_CLIENT_ID="$LINKEDIN_CLIENT_ID" LINKEDIN_CLIENT_SECRET="$LINKEDIN_CLIENT_SECRET" >/dev/null

az functionapp cors add -n "$FUNC_NAME" -g "$RG" --allowed-origins "$APP_BASE_URL" >/dev/null

cat > "$ENV_FILE" <<SETTINGS
RG=$RG
SWA_NAME=$SWA_NAME
FUNC_NAME=$FUNC_NAME
COSMOS_NAME=$COSMOS_NAME
STORAGE_NAME=$STORAGE_NAME
SWA_HOST=$SWA_HOST
FUNC_HOST=$FUNC_HOST
B2C_TENANT_NAME=$B2C_TENANT_NAME
B2C_CLIENT_ID=$B2C_CLIENT_ID
B2C_POLICY_NAME=$B2C_POLICY_NAME
SETTINGS

cat <<SUMMARY

Configuration complete.

Wrote deployment context to $ENV_FILE.

Next step:
  source "$ENV_FILE"
  scripts/azure/deploy.sh

Callback base URLs:
  App: $APP_BASE_URL
  API: $API_BASE_URL
SUMMARY
