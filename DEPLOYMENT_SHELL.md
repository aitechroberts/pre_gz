#!/usr/bin/env bash
set -euo pipefail          # fail fast, fail loud

# 0 ─── configurable names ────────────────────────────────────────────────────
RG="rg-govwin"
LOC="eastus"
COSMOS_ACC="govwin-cosmos"        # must be globally unique
DB_NAME="govwin"
CONTAINER="opportunities"
PARTITION="/id"
STORAGE="govwinsa"               # lower-case, 3-24 chars
FUNC_APP="govwin-ingest-func"
PLAN="Y1"                                 # Consumption
ACR="govwinacr"
CA_ENV="govwin-env"
CA_DASH="govwin-dashboard"
IMAGE_TAG="v1"
az storage account show-connection-string \
  --name $STORAGE \
  --resource-group $RG \
  --query connectionString \
  -o tsv
# 1 ─── resource group ────────────────────────────────────────────────────────
az group create -n "$RG" -l "$LOC"                                            \
  --output none

# 2 ─── Cosmos DB *serverless* account, DB, container ────────────────────────
az cosmosdb create \
  --name "$COSMOS_ACC" \
  --resource-group "$RG" \
  --locations regionName="$LOC" failoverPriority=0 isZoneRedundant=false \
  --capacity-mode Serverless \
  --default-consistency-level Eventual \
  --kind GlobalDocumentDB \
  --output none                                        # NoSQL API
                                                                                

az cosmosdb sql database create                                                \
  --account-name "$COSMOS_ACC" --resource-group "$RG"                          \
  --name "$DB_NAME" --output none                                              

az cosmosdb sql container create                                               \
  --account-name "$COSMOS_ACC" --resource-group "$RG"                          \
  --database-name "$DB_NAME" --name "$CONTAINER"                               \
  --partition-key-path "$PARTITION"                                            \
  --output none

# 3 ─── storage account (Functions requirement) ──────────────────────────────
az storage account create -n "$STORAGE" -g "$RG" -l "$LOC" --sku Standard_LRS  \
  --output none

# 4 ─── Python Function App (v2 model) ────────────────────────────────────────
az functionapp create                                                          \
  --name "$FUNC_APP" --resource-group "$RG"                                    \
  --storage-account "$STORAGE"                                                 \
  --consumption-plan-location "$LOC"                                           \
  --functions-version 4 --runtime python                                       \
  --runtime-version 3.11 --output none                                         

# 4a assign system-managed identity & DB role
az functionapp identity assign -g "$RG" -n "$FUNC_APP"                         \
  --output none

PRINCIPAL_ID=$(az functionapp identity show -g "$RG" -n "$FUNC_APP"            \
  --query principalId -o tsv)

COSMOS_SCOPE=$(az cosmosdb show -g "$RG" -n "$COSMOS_ACC"                      \
  --query id -o tsv)

az cosmosdb sql role assignment create \
  --account-name "$COSMOS_ACC" \
  --resource-group "$RG" \
  --role-definition-name "Cosmos DB Built-in Data Contributor" \
  --principal-id "$PRINCIPAL_ID" \
  --scope "/dbs/$DB_NAME"                                    

# 4b app settings (endpoint & search list)
COSMOS_URI=$(az cosmosdb show -g "$RG" -n "$COSMOS_ACC"                        \
  --query documentEndpoint -o tsv)

SEARCH_TERMS="Personnel Security, Background Investigation, Continuous Vetting, Security Adjudication, Human Capital Support, Audit Support Service, Security Assistant, Security Specialist, personnel security specialist, personnel security assistant, adjudicator, investigator, analyst, insider threat, vetting, support services, human capital, recruiting, staffing, classification, retirement, personnel action, benefits, auditing, investigative, intelligence, threat, PERSEC, HSPD12, Trusted Workforce, Trusted Workforce 2.0, TW2.0
"

az functionapp config appsettings set -g "$RG" -n "$FUNC_APP"                  \
  --settings COSMOS_URL="$COSMOS_URI" SEARCH_TERMS="$SEARCH_TERMS"             \
  --output none                                                                

# 5 ─── Azure Container Registry & Streamlit image ───────────────────────────
az acr create -n "$ACR" -g "$RG" --sku Basic --location "$LOC" --output none   # ACR doc:contentReference[oaicite:10]{index=10}

az acr login --name "$ACR"
docker build -t "$ACR.azurecr.io/govwin-dashboard:$IMAGE_TAG" ./dashboard
docker push "$ACR.azurecr.io/govwin-dashboard:$IMAGE_TAG"

# 6 ─── Container Apps environment and dashboard ─────────────────────────────
az containerapp env create -n "$CA_ENV" -g "$RG" -l "$LOC" --output none       # env CLI:contentReference[oaicite:11]{index=11}

az containerapp create                                                         \
  -n "$CA_DASH" -g "$RG" --environment "$CA_ENV"                               \
  --image "$ACR.azurecr.io/govwin-dashboard:$IMAGE_TAG"                        \
  --target-port 8501 --ingress external                                         \
  --registry-server "$ACR.azurecr.io"                                          \
  --env-vars COSMOS_URL="$COSMOS_URI"                                          \
  --output none                                                                # env-vars flag:contentReference[oaicite:12]{index=12}

# 7 ─── show useful connection info ──────────────────────────────────────────
COSMOS_KEY=$(az cosmosdb keys list -g "$RG" -n "$COSMOS_ACC" --type keys       \
  --query primaryMasterKey -o tsv)                                             # key retrieval doc:contentReference[oaicite:13]{index=13}

echo "-----------------------------------------------------------------------"
echo "Cosmos endpoint : $COSMOS_URI"
echo "Cosmos key      : $COSMOS_KEY"
echo "Function App URL: https://$FUNC_APP.azurewebsites.net"
echo "Dashboard URL   : $(az containerapp show -n $CA_DASH -g $RG --query properties.configuration.ingress.fqdn -o tsv)"
echo "-----------------------------------------------------------------------"
echo "Add the endpoint & key to your local.settings.json for local testing."
