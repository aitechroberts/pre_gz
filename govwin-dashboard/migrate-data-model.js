// add-user-fields.js
// Simple script to add user interaction fields (archived, userSaves, seenBy) to documents that don't have them
const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const CONTAINER_NAME = 'opportunities_optimized';

async function addUserFields() {
  console.log('👤 Adding user interaction fields to documents...');
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE UPDATE'}`);
  
  const client = new CosmosClient({
    endpoint: process.env.COSMOS_URL,
    key: process.env.COSMOS_KEY,
  });

  const database = client.database('govwin');
  const container = database.container(CONTAINER_NAME);

  try {
    // Find documents missing user interaction fields
    console.log('🔍 Finding documents missing user interaction fields...');
    const querySpec = {
      query: `SELECT * FROM c 
              WHERE NOT IS_DEFINED(c.archived) 
              OR NOT IS_DEFINED(c.userSaves) 
              OR NOT IS_DEFINED(c.seenBy)
              OR (IS_DEFINED(c.pursued) AND IS_BOOL(c.pursued))`
    };
    
    const { resources: docsNeedingUserFields } = await container.items.query(
      querySpec, 
      { enableCrossPartitionQuery: true }
    ).fetchAll();
    
    console.log(`📊 Found ${docsNeedingUserFields.length} documents needing user fields`);
    
    if (docsNeedingUserFields.length === 0) {
      console.log('✅ All documents already have user interaction fields!');
      return;
    }

    // Analyze what fields are missing
    const analysis = {
      needsArchived: 0,
      needsUserSaves: 0,
      needsSeenBy: 0,
      needsPursuedConversion: 0
    };
    
    docsNeedingUserFields.forEach(doc => {
      if (!doc.hasOwnProperty('archived')) analysis.needsArchived++;
      if (!doc.hasOwnProperty('userSaves')) analysis.needsUserSaves++;
      if (!doc.hasOwnProperty('seenBy')) analysis.needsSeenBy++;
      if (doc.hasOwnProperty('pursued') && typeof doc.pursued === 'boolean') analysis.needsPursuedConversion++;
    });
    
    console.log('\n📋 Field analysis:');
    console.log(`   Need archived field: ${analysis.needsArchived}`);
    console.log(`   Need userSaves field: ${analysis.needsUserSaves}`);
    console.log(`   Need seenBy field: ${analysis.needsSeenBy}`);
    console.log(`   Need pursued conversion: ${analysis.needsPursuedConversion}`);

    if (DRY_RUN) {
      console.log('\n📄 Sample documents that would be updated:');
      docsNeedingUserFields.slice(0, 5).forEach(doc => {
        const changes = [];
        if (!doc.hasOwnProperty('archived')) changes.push('add archived: {}');
        if (!doc.hasOwnProperty('userSaves')) changes.push('add userSaves: []');
        if (!doc.hasOwnProperty('seenBy')) changes.push('add seenBy: {}');
        if (doc.hasOwnProperty('pursued') && typeof doc.pursued === 'boolean') {
          changes.push(`convert pursued: ${doc.pursued} → {}`);
        }
        console.log(`   ${doc.id}: ${changes.join(', ')}`);
      });
      console.log(`\nRun without --dry-run to update ${docsNeedingUserFields.length} documents`);
      return;
    }

    // Update documents
    let updated = 0;
    let errors = 0;
    const errorDetails = [];
    
    console.log('\n🔧 Starting to update documents...');
    
    for (const doc of docsNeedingUserFields) {
      try {
        let wasModified = false;
        
        // Add archived field if missing
        if (!doc.hasOwnProperty('archived')) {
          doc.archived = {};
          wasModified = true;
        }
        
        // Add userSaves field if missing
        if (!doc.hasOwnProperty('userSaves')) {
          doc.userSaves = [];
          wasModified = true;
        } else if (!Array.isArray(doc.userSaves)) {
          // Fix userSaves if it's not an array
          doc.userSaves = [];
          wasModified = true;
        }
        
        // Add seenBy field if missing
        if (!doc.hasOwnProperty('seenBy')) {
          doc.seenBy = {};
          wasModified = true;
        }
        
        // Convert pursued from boolean to object if needed
        if (doc.hasOwnProperty('pursued') && typeof doc.pursued === 'boolean') {
          doc.pursued = {};
          wasModified = true;
        }
        
        // Only upsert if document was actually modified
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
    
    console.log(`\n✅ User fields update complete!`);
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
    const { resources: stillNeedingUserFields } = await container.items.query(
      querySpec, 
      { enableCrossPartitionQuery: true }
    ).fetchAll();
    console.log(`   Documents still needing user fields: ${stillNeedingUserFields.length}`);
    
    if (stillNeedingUserFields.length === 0) {
      console.log('🎉 All documents now have user interaction fields!');
    }
    
  } catch (error) {
    console.error('💥 Update failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await addUserFields();
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}