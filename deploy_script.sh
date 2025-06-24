#!/bin/bash

# Configuration variables
RESOURCE_GROUP="rg-govwin"
LOCATION="eastus"
ACR_NAME="govwinacr"
APP_NAME="govwin-opportunity-dashboard"
COSMOS_ACCOUNT="govwin-cosmos"
IMAGE_NAME="govwin-opportunity-dashboard"
TAG="latest"

echo "🚀 Starting GovWin Dashboard Deployment"
echo "Resource Group: $RESOURCE_GROUP"
echo "ACR Name: $ACR_NAME"
echo "App Name: $APP_NAME"

# Check if we're in the right directory (should have streamlit folder)
if [ ! -d "streamlit" ]; then
    echo "❌ Error: Please run this script from the root directory containing the streamlit folder"
    exit 1
fi

# 0. Export Poetry dependencies
echo "📦 Exporting Poetry dependencies..."
cd streamlit
poetry export -f requirements.txt --output requirements.txt --without-hashes
cd ..

# 1. Create Azure Container Registry
echo "📦 Creating Azure Container Registry..."
az acr create \
    --resource-group $RESOURCE_GROUP \
    --name $ACR_NAME \
    --sku Basic \
    --admin-enabled true

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)
echo "ACR Login Server: $ACR_LOGIN_SERVER"

# 2. Build and push Docker image (from root directory)
echo "🔨 Building Docker image..."
az acr build \
    --registry $ACR_NAME \
    --image $IMAGE_NAME:$TAG \
    --file Dockerfile \
    .

# 3. Create Container Apps Environment (if doesn't exist)
echo "🌐 Creating Container Apps Environment..."
az containerapp env create \
    --name "govwin-env" \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION

# 4. Get Cosmos DB URL
COSMOS_URL=$(az cosmosdb show \
    --name $COSMOS_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --query documentEndpoint \
    --output tsv)

echo "Cosmos URL: $COSMOS_URL"

# 5. Create Container App with Managed Identity
echo "🚀 Creating Container App..."
az containerapp create \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --environment "govwin-env" \
    --image "$ACR_LOGIN_SERVER/$IMAGE_NAME:$TAG" \
    --registry-server $ACR_LOGIN_SERVER \
    --cpu 1.0 \
    --memory 2.0Gi \
    --min-replicas 1 \
    --max-replicas 3 \
    --ingress external \
    --target-port 8501 \
    --env-vars \
        COSMOS_URL="$COSMOS_URL" \
        AZURE_CLIENT_ID="secretref:azure-client-id" \
    --system-assigned

# 6. Get the Container App's Managed Identity
echo "🔑 Configuring Managed Identity..."
APP_IDENTITY=$(az containerapp show \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --query identity.principalId \
    --output tsv)

echo "App Identity: $APP_IDENTITY"

# 7. Assign Cosmos DB permissions to Managed Identity
echo "🔐 Assigning Cosmos DB permissions..."

# Get Cosmos DB resource ID
COSMOS_ID=$(az cosmosdb show \
    --name $COSMOS_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --query id \
    --output tsv)

# Assign Cosmos DB Built-in Data Contributor role
az cosmosdb sql role assignment create \
    --account-name $COSMOS_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --role-definition-name "Cosmos DB Built-in Data Contributor" \
    --principal-id $APP_IDENTITY \
    --scope "/dbs/govwin"

# 8. Get the app URL first
APP_URL=$(az containerapp show \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --query properties.configuration.ingress.fqdn \
    --output tsv)

echo "App URL: https://$APP_URL"

# 9. Create Azure AD App Registration
echo "📝 Creating Azure AD App Registration..."
APP_REG_ID=$(az ad app create \
    --display-name "$APP_NAME-auth" \
    --web-redirect-uris "https://$APP_URL/.auth/login/aad/callback" \
    --query appId \
    --output tsv)

echo "App Registration ID: $APP_REG_ID"

# Create client secret
CLIENT_SECRET=$(az ad app credential reset \
    --id $APP_REG_ID \
    --query password \
    --output tsv)

# Get tenant ID
TENANT_ID=$(az account show --query tenantId --output tsv)

# 10. Create auth config file with actual values
echo "🔧 Creating authentication configuration..."
cat > auth-config.json << EOF
{
  "globalValidation": {
    "requireAuthentication": true,
    "unauthenticatedClientAction": "RedirectToLoginPage"
  },
  "identityProviders": {
    "azureActiveDirectory": {
      "enabled": true,
      "registration": {
        "openIdIssuer": "https://sts.windows.net/${TENANT_ID}/",
        "clientId": "${APP_REG_ID}",
        "clientSecretSettingName": "azure-client-secret"
      },
      "login": {
        "loginParameters": [
          "scope=openid profile email",
          "prompt=select_account"
        ]
      }
    }
  },
  "login": {
    "routes": {
      "logoutEndpoint": "/.auth/logout"
    }
  }
}
EOF

# 11. Update Container App with authentication secrets
echo "🔐 Adding authentication secrets..."
az containerapp secret set \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --secrets \
        azure-client-id="$APP_REG_ID" \
        azure-client-secret="$CLIENT_SECRET" \
        azure-tenant-id="$TENANT_ID"

# 12. Apply authentication configuration
echo "🔒 Enabling Azure AD Authentication..."
az containerapp auth update \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --config-file-path auth-config.json

echo "✅ Deployment Complete!"
echo "🌐 Access your dashboard at: https://$APP_URL"
echo "📋 App Registration ID: $APP_REG_ID"
echo "🆔 Tenant ID: $TENANT_ID"
echo ""
echo "Next steps:"
echo "1. Configure user access in Azure AD"
echo "2. Test the application"
echo "3. Monitor logs with: az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo ""
echo "Files created:"
echo "- auth-config.json (authentication configuration)"
echo "- streamlit/requirements.txt (exported from poetry)"