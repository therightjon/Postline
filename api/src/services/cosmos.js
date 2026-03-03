import { CosmosClient } from '@azure/cosmos';

let client = null;
let database = null;
const containers = {};

function getClient() {
  if (!client) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    if (!endpoint || !key) {
      throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set');
    }
    client = new CosmosClient({ endpoint, key });
    database = client.database(process.env.COSMOS_DATABASE || 'postline');
  }
  return database;
}

function getContainer(name) {
  if (!containers[name]) {
    containers[name] = getClient().container(name);
  }
  return containers[name];
}

// --- CRUD Helpers ---

export async function createItem(containerName, item) {
  const container = getContainer(containerName);
  const { resource } = await container.items.create({
    ...item,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return resource;
}

export async function getItem(containerName, id, partitionKey) {
  const container = getContainer(containerName);
  const { resource } = await container.item(id, partitionKey || id).read();
  return resource;
}

export async function updateItem(containerName, id, partitionKey, updates) {
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
  const container = getContainer(containerName);
  await container.item(id, partitionKey || id).delete();
}

export async function queryItems(containerName, query, parameters = []) {
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
  const db = getClient();
  const containerDefs = [
    { id: 'posts', partitionKey: '/userId' },
    { id: 'socialAccounts', partitionKey: '/userId' },
    { id: 'oauthStates', partitionKey: '/id' },
  ];

  for (const def of containerDefs) {
    try {
      await db.containers.createIfNotExists(def);
    } catch (err) {
      // Container may already exist — safe to ignore
    }
  }
}
