const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config({ path: '.env.local' });

const OLD_CONTAINER = 'opportunities_optimized';
const NEW_CONTAINER = 'opportunities';

(async () => {
  const client = new CosmosClient({
    endpoint: process.env.COSMOS_URL,
    key: process.env.COSMOS_KEY,
  });

  const db = client.database('govwin');
  const oldContainer = db.container(OLD_CONTAINER);
  const newContainer = db.container(NEW_CONTAINER);

  console.log('🔎 Fetching all documents from old container...');
  const query = { query: 'SELECT * FROM c' };
  const { resources: allDocs } = await oldContainer.items
    .query(query, { enableCrossPartitionQuery: true })
    .fetchAll();

  console.log(`📦 Fetched ${allDocs.length} docs. Deduplicating by ID...`);

  const latestById = {};

  for (const doc of allDocs) {
    const id = doc.id;
    if (!latestById[id]) {
      latestById[id] = doc;
    } else {
      const currDate = latestById[id].partitionDate || '0000-00-00';
      const nextDate = doc.partitionDate || '0000-00-00';
      if (nextDate > currDate) {
        latestById[id] = doc;
      }
    }
  }

  console.log(`🧹 Reduced to ${Object.keys(latestById).length} unique IDs.`);

  let inserted = 0;

  for (const doc of Object.values(latestById)) {
    delete doc._etag;
    delete doc._rid;
    delete doc._self;
    delete doc._attachments;
    delete doc._ts;

    await newContainer.items.upsert(doc);
    inserted++;
    if (inserted % 500 === 0) {
      console.log(`   ➕ Inserted ${inserted} items...`);
    }
  }

  console.log(`✅ Migration complete: ${inserted} documents upserted into '${NEW_CONTAINER}'`);
})();
