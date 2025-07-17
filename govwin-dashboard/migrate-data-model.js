// Robust migration script to ensure user interaction fields are always objects

const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const CONTAINER_NAME = 'opportunities_optimized';

function isObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val);
}

async function migrateUserFields() {
  console.log('🔄 Migrating user interaction fields to objects...');
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE UPDATE'}`);

  const client = new CosmosClient({
    endpoint: process.env.COSMOS_URL,
    key: process.env.COSMOS_KEY,
  });

  const database = client.database('govwin');
  const container = database.container(CONTAINER_NAME);

  try {
    // Find documents needing migration
    const querySpec = {
      query: `SELECT * FROM c 
              WHERE 
                NOT IS_DEFINED(c.archived) OR 
                NOT IS_DEFINED(c.userSaves) OR 
                NOT IS_DEFINED(c.seenBy) OR 
                NOT IS_DEFINED(c.pursued) OR
                (IS_DEFINED(c.archived) AND (IS_ARRAY(c.archived) OR IS_NULL(c.archived) OR IS_BOOL(c.archived))) OR
                (IS_DEFINED(c.userSaves) AND (IS_ARRAY(c.userSaves) OR IS_NULL(c.userSaves) OR IS_BOOL(c.userSaves))) OR
                (IS_DEFINED(c.seenBy) AND (IS_ARRAY(c.seenBy) OR IS_NULL(c.seenBy) OR IS_BOOL(c.seenBy))) OR
                (IS_DEFINED(c.pursued) AND (IS_ARRAY(c.pursued) OR IS_NULL(c.pursued) OR IS_BOOL(c.pursued)))`
    };

    const { resources: docs } = await container.items.query(
      querySpec,
      { enableCrossPartitionQuery: true }
    ).fetchAll();

    console.log(`📊 Found ${docs.length} documents needing migration`);

    if (docs.length === 0) {
      console.log('✅ All documents already have correct user interaction fields!');
      return;
    }

    if (DRY_RUN) {
      console.log('\n📄 Sample documents that would be updated:');
      docs.slice(0, 5).forEach(doc => {
        const changes = [];
        if (!isObject(doc.archived)) changes.push('archived → {}');
        if (!isObject(doc.userSaves)) changes.push('userSaves → {}');
        if (!isObject(doc.seenBy)) changes.push('seenBy → {}');
        if (!isObject(doc.pursued)) changes.push('pursued → {}');
        console.log(`   ${doc.id}: ${changes.join(', ')}`);
      });
      console.log(`\nRun without --dry-run to update ${docs.length} documents`);
      return;
    }

    let updated = 0;
    let errors = 0;
    const errorDetails = [];

    for (const doc of docs) {
      try {
        let wasModified = false;

        if (!isObject(doc.archived)) {
          doc.archived = {};
          wasModified = true;
        }
        if (!isObject(doc.userSaves)) {
          doc.userSaves = {};
          wasModified = true;
        }
        if (!isObject(doc.seenBy)) {
          doc.seenBy = {};
          wasModified = true;
        }
        if (!isObject(doc.pursued)) {
          doc.pursued = {};
          wasModified = true;
        }

        if (wasModified) {
          await container.items.upsert(doc);
          updated++;
          if (updated % 50 === 0) {
            console.log(`   ✅ Updated ${updated} documents...`);
          }
        }
      } catch (error) {
        errors++;
        errorDetails.push({
          docId: doc.id,
          error: error.message,
          partitionDate: doc.partitionDate
        });
        if (errors <= 5) {
          console.error(`   ❌ Error updating document ${doc.id}:`, error.message);
        }
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Documents updated: ${updated}`);
    console.log(`   Errors: ${errors}`);

    if (errors > 0) {
      console.log(`\n❌ Sample errors:`);
      errorDetails.slice(0, 3).forEach(err => {
        console.log(`   ${err.docId}: ${err.error}`);
      });
    }

    // Verify the update
    console.log('\n🔍 Verifying update...');
    const { resources: stillNeeding } = await container.items.query(
      querySpec,
      { enableCrossPartitionQuery: true }
    ).fetchAll();
    console.log(`   Documents still needing migration: ${stillNeeding.length}`);

    if (stillNeeding.length === 0) {
      console.log('🎉 All documents now have correct user interaction fields!');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await migrateUserFields();
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}