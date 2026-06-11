// Postline — full infrastructure for a single-user deployment.
//
// Provisions: Storage (media + Functions host), Cosmos DB (free tier),
// a Consumption Function App (API + scheduler), a Static Web App (Free),
// Application Insights, and optional failure alerting.
//
// Per-deployment secrets (SESSION_SECRET, TOKEN_ENCRYPTION_KEY) are generated
// at deploy time from newGuid() parameter defaults — each deployment gets its
// own values, and redeploying the template preserves them only if you pass the
// previous values back in. Day-to-day redeploys should use the GitHub Actions
// workflow or scripts/azure/deploy.sh (code-only), not this template.
//
// Compile: az bicep build --file infra/main.bicep --outfile infra/azuredeploy.json

@description('Globally-unique lowercase suffix for resource names (letters/numbers).')
@minLength(3)
@maxLength(12)
param suffix string = substring(uniqueString(resourceGroup().id), 0, 8)

@description('Region for compute/data resources.')
param location string = resourceGroup().location

@description('Region for the Static Web App (limited region set).')
@allowed(['westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia'])
param swaLocation string = 'eastus2'

@description('Admin sign-in password. Hashed in memory by the API at startup; switch to ADMIN_PASSWORD_HASH later for defense in depth.')
@secure()
@minLength(12)
param adminPassword string

@description('Comma-separated emails allowed to sign in via optional OIDC providers. Empty = first sign-in claims the instance.')
param allowedEmails string = ''

@description('Email address for failure alerts. Empty = no alerting resources.')
param alertEmail string = ''

@description('Cosmos DB free tier (one account per subscription). Set false if yours is already used.')
param cosmosFreeTier bool = true

@description('Auto-generated; do not set unless restoring a previous deployment.')
@secure()
param sessionSecretSeed string = '${newGuid()}${newGuid()}'

@description('Auto-generated; do not set unless restoring a previous deployment. Must decode to 32 bytes of base64.')
@secure()
param tokenEncryptionKeySeed string = newGuid()

var storageName = 'postlinest${suffix}'
var cosmosName = 'postline-cosmos-${suffix}'
var funcName = 'postline-api-${suffix}'
var swaName = 'postline-web-${suffix}'
var planName = 'postline-plan-${suffix}'
var insightsName = 'postline-ai-${suffix}'
var workspaceName = 'postline-logs-${suffix}'

var sessionSecret = base64(sessionSecretSeed)
// A GUID minus dashes is exactly 32 ASCII chars -> base64 decodes to 32 bytes,
// which is what the API's AES-256-GCM token encryption requires.
var tokenEncryptionKey = base64(replace(tokenEncryptionKeySeed, '-', ''))

var apiBaseUrl = 'https://${funcName}.azurewebsites.net'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: cosmosFreeTier
    locations: [
      { locationName: location, failoverPriority: 0, isZoneRedundant: false }
    ]
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: 'postline'
  properties: {
    resource: { id: 'postline' }
    options: { throughput: 400 }
  }
}

resource postsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDb
  name: 'posts'
  properties: {
    resource: {
      id: 'posts'
      partitionKey: { paths: ['/userId'], kind: 'Hash' }
    }
  }
}

resource accountsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDb
  name: 'socialAccounts'
  properties: {
    resource: {
      id: 'socialAccounts'
      partitionKey: { paths: ['/userId'], kind: 'Hash' }
    }
  }
}

resource statesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDb
  name: 'oauthStates'
  properties: {
    resource: {
      id: 'oauthStates'
      partitionKey: { paths: ['/id'], kind: 'Hash' }
      // Per-item TTL: ephemeral OAuth state records carry a ttl and
      // auto-purge; the owner-claim record has no ttl and persists.
      defaultTtl: -1
    }
  }
}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  kind: 'functionapp'
  sku: { name: 'Y1', tier: 'Dynamic' }
  properties: { reserved: true } // Linux
}

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: swaLocation
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

var storageConnection = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

resource func 'Microsoft.Web/sites@2023-12-01' = {
  name: funcName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|20'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: ['https://${swa.properties.defaultHostname}']
      }
      appSettings: [
        { name: 'AzureWebJobsStorage', value: storageConnection }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
        { name: 'COSMOS_KEY', value: cosmos.listKeys().primaryMasterKey }
        { name: 'COSMOS_DATABASE', value: 'postline' }
        { name: 'BLOB_CONNECTION_STRING', value: storageConnection }
        { name: 'BLOB_CONTAINER', value: 'media' }
        { name: 'ADMIN_PASSWORD', value: adminPassword }
        { name: 'SESSION_SECRET', value: sessionSecret }
        { name: 'SESSION_TTL_HOURS', value: '12' }
        { name: 'TOKEN_ENCRYPTION_KEY', value: tokenEncryptionKey }
        { name: 'ALLOWED_EMAILS', value: allowedEmails }
        { name: 'APP_BASE_URL', value: 'https://${swa.properties.defaultHostname}' }
        { name: 'API_BASE_URL', value: apiBaseUrl }
        { name: 'MEDIA_ALLOWED_HOSTS', value: '${storage.name}.blob.${environment().suffixes.storage}' }
        { name: 'MEDIA_SAS_TTL_MINUTES', value: '60' }
        { name: 'PUBLISH_MEDIA_SAS_TTL_MINUTES', value: '120' }
        { name: 'MAX_MEDIA_BYTES', value: '10485760' }
        { name: 'ALLOWED_MEDIA_TYPES', value: 'image/jpeg,image/png,image/webp,image/gif,video/mp4' }
        { name: 'OAUTH_STATE_TTL_MS', value: '600000' }
      ]
    }
  }
}

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (!empty(alertEmail)) {
  name: 'postline-alerts-${suffix}'
  location: 'global'
  properties: {
    groupShortName: 'postline'
    enabled: true
    emailReceivers: [
      { name: 'owner', emailAddress: alertEmail, useCommonAlertSchema: true }
    ]
  }
}

resource failureAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (!empty(alertEmail)) {
  name: 'postline-http5xx-${suffix}'
  location: 'global'
  properties: {
    description: 'Postline API is returning server errors (publish failures, scheduler crashes, misconfiguration).'
    severity: 2
    enabled: true
    scopes: [func.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'http5xx'
          metricName: 'Http5xx'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      { actionGroupId: actionGroup.id }
    ]
  }
}

output staticWebAppName string = swa.name
output staticWebAppHostname string = swa.properties.defaultHostname
output functionAppName string = func.name
output functionAppHostname string = func.properties.defaultHostName
output cosmosAccountName string = cosmos.name
output storageAccountName string = storage.name
output nextSteps string = 'Infrastructure is ready. Deploy the code: set RG/SWA_NAME/FUNC_NAME and run scripts/azure/deploy.sh, or use the GitHub Actions deploy workflow. Then sign in with the admin password you chose.'
