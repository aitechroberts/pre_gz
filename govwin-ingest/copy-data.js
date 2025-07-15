// copy-data.js
const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config({ path: '.env.local' });

async function copyData() {
  const client = new CosmosClient({
    endpoint: process.env.COSMOS_URL,
    key: process.env.COSMOS_KEY,
  });

  const database = client.database('govwin');
  const sourceContainer = database.container('opportunities_optimized');
  const targetContainer = database.container('testing');

  console.log('Starting data copy...');
  
  const { resources } = await sourceContainer.items.readAll().fetchAll();
  console.log(`Found ${resources.length} documents to copy`);

  let copied = 0;
  for (const doc of resources) {
    try {
      await targetContainer.items.create(doc);
      copied++;
      if (copied % 100 === 0) {
        console.log(`Copied ${copied}/${resources.length} documents`);
      }
    } catch (error) {
      console.error(`Error copying document ${doc.id}:`, error.message);
    }
  }

  console.log(`✅ Copy complete! Copied ${copied} documents`);
}

copyData().catch(console.error);