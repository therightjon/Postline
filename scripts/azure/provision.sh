#!/usr/bin/env bash
set -euo pipefail

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI (az) is required." >&2
  exit 1
fi

: "${SUBSCRIPTION_ID:?Set SUBSCRIPTION_ID to your Azure subscription id}"
: "${SUFFIX:?Set SUFFIX to a globally unique suffix (lowercase letters/numbers)}"

RG="${RG:-rg-postline-eastus}"
LOC="${LOC:-eastus}"
SWA_LOC="${SWA_LOC:-eastus2}"

SWA_NAME="${SWA_NAME:-postline-web-${SUFFIX}}"
FUNC_NAME="${FUNC_NAME:-postline-api-${SUFFIX}}"
COSMOS_NAME="${COSMOS_NAME:-postline-cosmos-${SUFFIX}}"
STORAGE_NAME="${STORAGE_NAME:-postlinest${SUFFIX}}"

if [[ ! "$STORAGE_NAME" =~ ^[a-z0-9]{3,24}$ ]]; then
  echo "STORAGE_NAME must be 3-24 lowercase letters/numbers. Current: $STORAGE_NAME" >&2
  exit 1
fi

az account set -s "$SUBSCRIPTION_ID"

echo "Creating resource group: $RG ($LOC)"
az group create -n "$RG" -l "$LOC" >/dev/null

echo "Creating storage account: $STORAGE_NAME"
az storage account create \
  -n "$STORAGE_NAME" -g "$RG" -l "$LOC" \
  --sku Standard_LRS --kind StorageV2 \
  --allow-blob-public-access false --https-only true >/dev/null

echo "Creating Cosmos DB account: $COSMOS_NAME (free tier)"
az cosmosdb create -n "$COSMOS_NAME" -g "$RG" --enable-free-tier true >/dev/null

echo "Creating Cosmos DB SQL database and containers"
az cosmosdb sql database create -a "$COSMOS_NAME" -g "$RG" -n postline --throughput 400 >/dev/null
az cosmosdb sql container create -a "$COSMOS_NAME" -g "$RG" -d postline -n posts -p /userId >/dev/null
az cosmosdb sql container create -a "$COSMOS_NAME" -g "$RG" -d postline -n socialAccounts -p /userId >/dev/null
az cosmosdb sql container create -a "$COSMOS_NAME" -g "$RG" -d postline -n oauthStates -p /id >/dev/null

echo "Creating Function App: $FUNC_NAME"
az functionapp create \
  -n "$FUNC_NAME" -g "$RG" -s "$STORAGE_NAME" \
  --consumption-plan-location "$LOC" \
  --runtime node --runtime-version 20 \
  --functions-version 4 --os-type Linux >/dev/null

echo "Creating Static Web App: $SWA_NAME"
az staticwebapp create -n "$SWA_NAME" -g "$RG" -l "$SWA_LOC" --sku Free >/dev/null

cat <<SUMMARY

Provisioning complete.

Use these variables for the next step:
  export RG="$RG"
  export SWA_NAME="$SWA_NAME"
  export FUNC_NAME="$FUNC_NAME"
  export COSMOS_NAME="$COSMOS_NAME"
  export STORAGE_NAME="$STORAGE_NAME"

Then run:
  scripts/azure/configure.sh
SUMMARY
