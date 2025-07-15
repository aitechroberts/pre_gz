// src/lib/test-cosmos.ts
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables explicitly from the root directory
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testConnection() {
  try {
    console.log('Environment Check:');
    console.log('COSMOS_URL:', process.env.COSMOS_URL);
    console.log('COSMOS_DATABASE:', process.env.COSMOS_DATABASE);
    console.log('COSMOS_CONTAINER:', process.env.COSMOS_CONTAINER);
    console.log('');

    // Import and test cosmos connection
    const { cosmosService } = await import('./cosmos');
    
    console.log('Testing Cosmos DB connection...');
    const filterOptions = await cosmosService.getFilterOptions();
    
    console.log('✅ Cosmos DB connection successful!');
    console.log('Available sources:', filterOptions.sources);
    console.log('Available NAICS count:', filterOptions.naics.length);
    console.log('Available PSC count:', filterOptions.psc.length);
    console.log('Available status options:', filterOptions.status);
    
    return true;
  } catch (error) {
    console.error('❌ Cosmos DB connection failed:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

testConnection();