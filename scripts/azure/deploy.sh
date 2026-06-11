#!/usr/bin/env bash
set -euo pipefail

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI (az) is required." >&2
  exit 1
fi

if ! command -v func >/dev/null 2>&1; then
  echo "Azure Functions Core Tools (func) is required." >&2
  exit 1
fi

if ! command -v swa >/dev/null 2>&1; then
  echo "Azure Static Web Apps CLI (swa) is required." >&2
  exit 1
fi

if [[ -f .azure-postline.env ]]; then
  # shellcheck disable=SC1091
  source .azure-postline.env
fi

: "${RG:?Set RG to your resource group name}"
: "${SWA_NAME:?Set SWA_NAME to your Static Web App name}"
: "${FUNC_NAME:?Set FUNC_NAME to your Function App name}"

FUNC_HOST="${FUNC_HOST:-$(az functionapp show -n "$FUNC_NAME" -g "$RG" --query defaultHostName -o tsv)}"

pushd api >/dev/null
npm ci
func azure functionapp publish "$FUNC_NAME" --javascript --no-build
popd >/dev/null

pushd client >/dev/null
npm ci
VITE_API_BASE_URL="https://${FUNC_HOST}/api" \
npm run build
popd >/dev/null

DEPLOY_TOKEN="$(az staticwebapp secrets list -n "$SWA_NAME" -g "$RG" --query properties.apiKey -o tsv)"
swa deploy ./client/dist --deployment-token "$DEPLOY_TOKEN" --env production --swa-config-location .

echo "Deploy complete."
