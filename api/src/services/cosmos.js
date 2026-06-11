import { CosmosClient } from '@azure/cosmos';

let client = null;
let database = null;
let initPromise = null;
const containers = {};

// When true (docker-compose / emulator), the database and containers are
// created on first use instead of by provisioning scripts.
const AUTO_INIT = process.env.COSMOS_AUTO_INIT === 'true';

function getClient() {
  if (!client) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    if (!endpoint || !key) {
      throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set');
    }
    client = new CosmosClient({ endpoint, key });
    database = client.database(process.env.COSMOS_DATABASE || 'postline');
    if (AUTO_INIT) {
      initPromise = initializeDatabase();
    }
  }
  return database;
}

function getContainer(name) {
  if (!containers[name]) {
    const db = getClient();
    containers[name] = db.container(name);
  }
  return containers[name];
}

async function ensureInitialized() {
  if (initPromise) {
    await initPromise;
  }
}

// --- CRUD Helpers ---

export async function createItem(containerName, item) {
  await ensureInitialized();
  const container = getContainer(containerName);
  const { resource } = await container.items.create({
    ...item,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return resource;
}

export async function getItem(containerName, id, partitionKey) {
  await ensureInitialized();
  const container = getContainer(containerName);
  const { resource } = await container.item(id, partitionKey || id).read();
  return resource;
}

export async function updateItem(containerName, id, partitionKey, updates) {
  await ensureInitialized();
  const container = getContainer(containerName);
  const { resource: existing } = await container.item(id, partitionKey || id).read();
  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  const { resource } = await container.item(id, partitionKey || id).replace(updated);
  return resource;
}

export async function deleteItem(containerName, id, partitionKey) {
  await ensureInitialized();
  const container = getContainer(containerName);
  await container.item(id, partitionKey || id).delete();
}

export async function queryItems(containerName, query, parameters = []) {
  await ensureInitialized();
  const container = getContainer(containerName);
  const { resources } = await container.items
    .query({ query, parameters })
    .fetchAll();
  return resources;
}

export async function listByUser(containerName, userId) {
  return queryItems(
    containerName,
    'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC',
    [{ name: '@userId', value: userId }]
  );
}

// --- Initialize Database ---

export async function initializeDatabase() {
  const databaseName = process.env.COSMOS_DATABASE || 'postline';
  const { database: db } = await client.databases.createIfNotExists({ id: databaseName });
  const containerDefs = [
    { id: 'posts', partitionKey: { paths: ['/userId'] } },
    { id: 'socialAccounts', partitionKey: { paths: ['/userId'] } },
    { id: 'oauthStates', partitionKey: { paths: ['/id'] }, defaultTtl: -1 },
  ];

  for (const def of containerDefs) {
    await db.containers.createIfNotExists(def);
  }
}
