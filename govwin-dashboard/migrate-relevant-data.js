// migrate-seenby-reassignment.js
// Usage:  node migrate-seenby-reassignment.js   (--dry-run)

const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config({ path: '.env.local' });

const DRY_RUN        = process.argv.includes('--dry-run');
const CONTAINER_NAME = 'opportunities_optimized';

/** <<<  put the 5 opportunity IDs here  >>> */
const TARGET_IDS = [
  'OPP256388',
  'OPP249859',
  'OPP244499',
  'OPP247530',
  'OPP187362',
];

(async () => {
  const client     = new CosmosClient({ endpoint: process.env.COSMOS_URL, key: process.env.COSMOS_KEY });
  const container  = client.database('govwin').container(CONTAINER_NAME);

  let updated = 0;

  for (const id of TARGET_IDS) {
    // ✅ read the doc (second param is the *partition key*, which is still partitionDate for now)
    // We find the document regardless of date so we enable cross-partition query
    const query = {
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: id }],
    };
    const { resources: docs } = await container.items
      .query(query, { enableCrossPartitionQuery: true })
      .fetchAll();

    for (const doc of docs) {
      const before = JSON.stringify({ archived: doc.archived, userSaves: doc.userSaves });

      if (doc.relevant === false) {
        doc.archived = { ...doc.seenBy };          // copy seenBy → archived
      } else if (doc.relevant === true) {
        doc.userSaves = { ...doc.seenBy };         // copy seenBy → userSaves
      } else {
        console.log(`⚠️  id ${doc.id} has relevant = null / undefined – skipped`);
        continue;
      }

      const after = JSON.stringify({ archived: doc.archived, userSaves: doc.userSaves });

      if (before === after) {
        console.log(`ℹ️  id ${doc.id} already in desired state – skipped`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`🔎 DRY-RUN would update id ${doc.id}\n    BEFORE ${before}\n    AFTER  ${after}`);
      } else {
        await container.items.upsert(doc);
        updated++;
        console.log(`✅ Updated id ${doc.id}`);
      }
    }
  }

  if (!DRY_RUN) console.log(`🎉 Migration complete – ${updated} document(s) updated`);
})();
