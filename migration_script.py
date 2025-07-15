"""
Simple Migration Script: opportunities -> opportunities_optimized
Adds partitionDate field and copies data to new container
"""

import os
import logging
import datetime as dt
from azure.cosmos import CosmosClient

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_cosmos_client():
    """Get Cosmos DB client using environment variables"""
    url = os.getenv("COSMOS_URL")
    key = os.getenv("COSMOS_KEY")
    
    if not url or not key:
        raise ValueError("Please set COSMOS_URL and COSMOS_KEY environment variables")
    
    return CosmosClient(url, key)

def add_partition_date_field(document):
    """Add partitionDate field to a document based on existing date fields"""
    
    # Try to get date from these fields in order of preference
    date_fields = ["ingestedAt", "createdDate", "originalPostedDt"]
    
    document_date = None
    
    for field in date_fields:
        if field in document and document[field]:
            try:
                date_value = document[field]
                
                # Handle string dates
                if isinstance(date_value, str):
                    # Remove 'Z' and handle timezone
                    date_value = date_value.replace('Z', '+00:00')
                    document_date = dt.datetime.fromisoformat(date_value)
                else:
                    document_date = date_value
                
                break  # Use the first valid date found
                
            except (ValueError, TypeError) as e:
                logger.warning(f"Could not parse {field} for document {document.get('id')}: {e}")
                continue
    
    # If no valid date found, use today
    if not document_date:
        logger.warning(f"No valid date found for document {document.get('id')}, using today")
        document_date = dt.datetime.utcnow()
    
    # Add the partition date in YYYY-MM-DD format
    document["partitionDate"] = document_date.strftime("%Y-%m-%d")
    
    # Make sure ingestedAt exists
    if "ingestedAt" not in document:
        document["ingestedAt"] = dt.datetime.utcnow().isoformat() + "Z"
    
    return document

def migrate_data():
    """Migrate data from opportunities to opportunities_optimized"""
    
    client = get_cosmos_client()
    database = client.get_database_client("govwin")
    
    # Get source and target containers
    source_container = database.get_container_client("opportunities")
    target_container = database.get_container_client("opportunities_optimized")
    
    logger.info("Starting data migration...")
    logger.info("Source: opportunities")
    logger.info("Target: opportunities_optimized")
    
    # Count total documents first
    count_query = "SELECT VALUE COUNT(1) FROM c"
    total_docs = list(source_container.query_items(
        count_query, 
        enable_cross_partition_query=True
    ))[0]
    
    logger.info(f"Total documents to migrate: {total_docs}")
    
    # Migrate data in batches
    batch_size = 100
    migrated_count = 0
    error_count = 0
    
    # Query all documents
    query = "SELECT * FROM c"
    items = source_container.query_items(
        query=query,
        enable_cross_partition_query=True,
        max_item_count=batch_size
    )
    
    batch = []
    
    for item in items:
        try:
            # Add partition date field
            updated_item = add_partition_date_field(item.copy())
            batch.append(updated_item)
            
            # Process batch when it's full
            if len(batch) >= batch_size:
                processed = process_batch(target_container, batch)
                migrated_count += processed
                error_count += (len(batch) - processed)
                
                # Log progress
                progress = (migrated_count + error_count) / total_docs * 100
                logger.info(f"Progress: {progress:.1f}% ({migrated_count} migrated, {error_count} errors)")
                
                batch = []
        
        except Exception as e:
            logger.error(f"Error processing document {item.get('id', 'unknown')}: {e}")
            error_count += 1
    
    # Process any remaining documents in the final batch
    if batch:
        processed = process_batch(target_container, batch)
        migrated_count += processed
        error_count += (len(batch) - processed)
    
    logger.info("Migration completed!")
    logger.info(f"Successfully migrated: {migrated_count}")
    logger.info(f"Errors: {error_count}")
    logger.info(f"Success rate: {migrated_count/(migrated_count+error_count)*100:.1f}%")
    
    return migrated_count, error_count

def process_batch(container, batch):
    """Insert a batch of documents into the target container"""
    success_count = 0
    
    for doc in batch:
        try:
            container.upsert_item(doc)
            success_count += 1
        except Exception as e:
            logger.error(f"Failed to insert document {doc.get('id', 'unknown')}: {e}")
    
    return success_count

def validate_migration():
    """Validate that the migration was successful"""
    
    client = get_cosmos_client()
    database = client.get_database_client("govwin")
    
    source_container = database.get_container_client("opportunities")
    target_container = database.get_container_client("opportunities_optimized")
    
    logger.info("Validating migration...")
    
    # Count documents in both containers
    count_query = "SELECT VALUE COUNT(1) FROM c"
    
    source_count = list(source_container.query_items(
        count_query, enable_cross_partition_query=True
    ))[0]
    
    target_count = list(target_container.query_items(
        count_query, enable_cross_partition_query=True
    ))[0]
    
    logger.info(f"Source container documents: {source_count}")
    logger.info(f"Target container documents: {target_count}")
    
    if source_count == target_count:
        logger.info("✅ Document counts match!")
        success = True
    else:
        logger.warning(f"⚠️ Document count mismatch!")
        success = False
    
    # Check that partitionDate was added to sample documents
    sample_query = "SELECT TOP 5 c.id, c.partitionDate, c.ingestedAt FROM c"
    sample_docs = list(target_container.query_items(
        sample_query, enable_cross_partition_query=True
    ))
    
    logger.info("Sample of migrated documents:")
    for doc in sample_docs:
        logger.info(f"  ID: {doc.get('id')}, Partition: {doc.get('partitionDate')}, Ingested: {doc.get('ingestedAt')}")
    
    # Check that all documents have partitionDate
    missing_partition_query = "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.partitionDate)"
    missing_count = list(target_container.query_items(
        missing_partition_query, enable_cross_partition_query=True
    ))[0]
    
    if missing_count == 0:
        logger.info("✅ All documents have partitionDate field!")
    else:
        logger.warning(f"⚠️ {missing_count} documents missing partitionDate field!")
        success = False
    
    return success

if __name__ == "__main__":
    print("🚀 Starting Cosmos DB Migration")
    print("=" * 50)
    
    try:
        # Step 1: Migrate data
        migrated, errors = migrate_data()
        
        if errors == 0:
            print("\n" + "=" * 50)
            print("✅ Migration completed successfully!")
            
            # Step 2: Validate migration
            print("\n🔍 Validating migration...")
            validation_success = validate_migration()
            
            if validation_success:
                print("\n🎉 Migration validation passed!")
                print("\nNext steps:")
                print("1. Test your application with the new container")
                print("2. Update your connection to use 'opportunities_optimized'")
                print("3. Monitor performance improvements")
            else:
                print("\n❌ Migration validation failed - check logs above")
        else:
            print(f"\n⚠️ Migration completed with {errors} errors")
            print("Check the logs above for details")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        print(f"\n❌ Migration failed: {e}")