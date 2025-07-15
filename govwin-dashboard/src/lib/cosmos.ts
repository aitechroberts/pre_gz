// src/lib/cosmos.ts
import { CosmosClient, Container, SqlQuerySpec } from '@azure/cosmos';
import { OpportunityDocument, OpportunityFilters, PaginationParams, SortParams } from './types';

class CosmosService {
  private client: CosmosClient;
  private container: Container;

  constructor() {
    // ① resolve endpoint from either env-var
    const endpoint = "https://govwin-cosmos.documents.azure.com:443/";       // what you may use locally

    const key = "6Mabjkx3ZOYNMlkb7V3OURbtXP1cwSo2VmFnNFJbL16ttxqxJX3IKiJ8OEOJnhdrSX0LIrOqYdaxACDbRGGM1A==";

    // ② fail fast & loud if still missing
    if (!endpoint || !key) {
      throw new Error(
        "❌  Missing Cosmos config: set COSMOS_URL (or COSMOS_ENDPOINT) and COSMOS_KEY"
      );
    }

    this.client = new CosmosClient({ endpoint, key });

    const database = this.client.database(
      process.env.COSMOS_DATABASE ?? "govwin"
    );
    this.container = database.container(
      process.env.COSMOS_CONTAINER ?? "opportunities_optimized"
    );
  }

  // Helper method to find opportunity with correct partition key
  private async findOpportunityWithCorrectPartition(opportunityId: string): Promise<any> {
    // Try today's date first (most common for new opportunities)
    const todayPartition = new Date().toISOString().split('T')[0];
    
    try {
      const { resource } = await this.container.item(opportunityId, todayPartition).read();
      if (resource) return resource;
    } catch (error) {
      // Opportunity not found with today's partition, try query approach
    }

    // If not found, query without partition key (slower but guaranteed to work)
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: opportunityId }]
    };

    const { resources } = await this.container.items.query(querySpec).fetchAll();
    
    if (resources.length === 0) {
      throw new Error('Opportunity not found');
    }

    return resources[0];
  }

  /**
   * Mark opportunity as seen by user
   */
  async markOpportunitySeen(opportunityId: string, userId: string): Promise<boolean> {
    try {
      const opportunity = await this.findOpportunityWithCorrectPartition(opportunityId);
      
      // Initialize seenBy if it doesn't exist
      opportunity.seenBy = opportunity.seenBy || {};
      opportunity.seenBy[userId] = new Date().toISOString();

      // Use the opportunity's actual partition key for the update
      const partitionKey = opportunity.partitionKey || opportunity.partitionDate?.split('T')[0] || new Date().toISOString().split('T')[0];
      
      await this.container.item(opportunityId, partitionKey).replace(opportunity);
      return true;
    } catch (error) {
      console.error('Error marking opportunity as seen:', error);
      return false;
    }
  }

  /**
   * Archive/unarchive opportunity for user
   */
  async archiveOpportunity(opportunityId: string, userId: string): Promise<boolean> {
    try {
      const opportunity = await this.findOpportunityWithCorrectPartition(opportunityId);

      // Initialize fields if they don't exist
      opportunity.seenBy = opportunity.seenBy || {};
      opportunity.archived = opportunity.archived || {};
      
      // Mark as seen
      opportunity.seenBy[userId] = new Date().toISOString();
      
      // Toggle archived status
      const isCurrentlyArchived = opportunity.archived[userId] != null;
      if (isCurrentlyArchived) {
        delete opportunity.archived[userId]; // Unarchive
      } else {
        opportunity.archived[userId] = new Date().toISOString(); // Archive
      }

      // Use the opportunity's actual partition key for the update
      const partitionKey = opportunity.partitionKey || opportunity.partitionDate?.split('T')[0] || new Date().toISOString().split('T')[0];
      
      await this.container.item(opportunityId, partitionKey).replace(opportunity);
      return !isCurrentlyArchived; // Return new archived state
    } catch (error) {
      console.error('Error archiving opportunity:', error);
      return false;
    }
  }

  /**
   * Save/unsave opportunity for user
   */
  async toggleOpportunitySaved(opportunityId: string, userId: string): Promise<boolean> {
    try {
      const opportunity = await this.findOpportunityWithCorrectPartition(opportunityId);

      // Initialize fields if they don't exist
      opportunity.userSaves = opportunity.userSaves || [];
      opportunity.seenBy = opportunity.seenBy || {};
      
      const isSaved = opportunity.userSaves.includes(userId);
      
      if (isSaved) {
        // Unsave: remove from saves, set relevant to null
        opportunity.userSaves = opportunity.userSaves.filter((id: string) => id !== userId);
        opportunity.relevant = null;
      } else {
        // Save: add to saves, mark as seen and relevant
        opportunity.userSaves.push(userId);
        opportunity.seenBy[userId] = new Date().toISOString();
        opportunity.relevant = true; // true = saved
      }

      // Use the opportunity's actual partition key for the update
      const partitionKey = opportunity.partitionKey || opportunity.partitionDate?.split('T')[0] || new Date().toISOString().split('T')[0];
      
      await this.container.item(opportunityId, partitionKey).replace(opportunity);
      return !isSaved; // Return new saved state
    } catch (error) {
      console.error('Error toggling opportunity saved state:', error);
      return false;
    }
  }

  /**
   * Get opportunities with filters, pagination, and sorting
   */
  async getOpportunities(
    filters: OpportunityFilters,
    pagination: PaginationParams,
    sort: SortParams
  ) {
    try {
      // Build query conditions
      const conditions: string[] = [];
      const parameters: any[] = [];

      // Date range filter
      if (filters.dateRange.from) {
        conditions.push('c.ingestedAt >= @fromDate');
        parameters.push({ name: '@fromDate', value: filters.dateRange.from.toISOString() });
      }
      
      if (filters.dateRange.to) {
        conditions.push('c.ingestedAt <= @toDate');
        parameters.push({ name: '@toDate', value: filters.dateRange.to.toISOString() });
      }

      // Sources filter
      if (filters.sources.length > 0) {
        const sourceParams = filters.sources.map((_, i) => `@source${i}`);
        conditions.push(`c.source IN (${sourceParams.join(', ')})`);
        filters.sources.forEach((source, i) => {
          parameters.push({ name: `@source${i}`, value: source });
        });
      }

      // Status filter
      if (filters.status.length > 0) {
        const statusParams = filters.status.map((_, i) => `@status${i}`);
        conditions.push(`c.status IN (${statusParams.join(', ')})`);
        filters.status.forEach((status, i) => {
          parameters.push({ name: `@status${i}`, value: status });
        });
      }

      // NAICS and PSC filters (OR logic within each, AND between them)
      const opportunityConditions: string[] = [];
      
      if (filters.naics.length > 0) {
        const naicsConditions: string[] = [];
        
        // Primary NAICS
        const primaryNaicsParams = filters.naics.map((_, i) => `@naics${i}`);
        naicsConditions.push(`c.primaryNAICS.id IN (${primaryNaicsParams.join(', ')})`);
        
        // Additional NAICS
        filters.naics.forEach((naics, i) => {
          naicsConditions.push(`ARRAY_CONTAINS(c.allNAICSCodes, @naics${i})`);
          parameters.push({ name: `@naics${i}`, value: naics });
        });
        
        opportunityConditions.push(`(${naicsConditions.join(' OR ')})`);
      }

      if (filters.psc.length > 0) {
        const pscParams = filters.psc.map((_, i) => `@psc${i}`);
        opportunityConditions.push(`c.classificationCodeDesc IN (${pscParams.join(', ')})`);
        filters.psc.forEach((psc, i) => {
          parameters.push({ name: `@psc${i}`, value: psc });
        });
      }

      if (filters.searchTerms && filters.searchTerms.length > 0) {
        const searchTermParams = filters.searchTerms.map((_, i) => `@searchTerm${i}`);
        opportunityConditions.push(`c.searchTerm IN (${searchTermParams.join(', ')})`);
        filters.searchTerms.forEach((term, i) => {
          parameters.push({ name: `@searchTerm${i}`, value: term });
        });
      }

      if (opportunityConditions.length > 0) {
        conditions.push(`(${opportunityConditions.join(' OR ')})`);
      }

      // User-specific filters
      if (filters.seenFilter && filters.seenFilter.length > 0) {
        const seenConditions: string[] = [];
        
        if (filters.seenFilter.includes('seen')) {
          seenConditions.push('(IS_DEFINED(c.seenBy) AND c.seenBy != {})');
        }
        if (filters.seenFilter.includes('unseen')) {
          seenConditions.push('(NOT IS_DEFINED(c.seenBy) OR c.seenBy = {})');
        }
        
        if (seenConditions.length > 0) {
          conditions.push(`(${seenConditions.join(' OR ')})`);
        }
      }

      if (filters.relevantFilter && filters.relevantFilter.length > 0) {
        const relevantConditions: string[] = [];
        
        if (filters.relevantFilter.includes('saved')) {
          relevantConditions.push('c.relevant = true');
        }
        if (filters.relevantFilter.includes('archived')) {
          relevantConditions.push('(IS_DEFINED(c.archived) AND c.archived != {})');
        }
        if (filters.relevantFilter.includes('unreviewed')) {
          relevantConditions.push('(NOT IS_DEFINED(c.relevant) OR c.relevant = null)');
        }
        
        if (relevantConditions.length > 0) {
          conditions.push(`(${relevantConditions.join(' OR ')})`);
        }
      }

      // Build final query
      // Build final query - Cosmos DB compatible syntax
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderClause = `ORDER BY c.${sort.field} ${sort.direction.toUpperCase()}`;

      // Cosmos DB uses TOP instead of LIMIT, and different OFFSET syntax
      const query = `SELECT TOP ${pagination.limit} * FROM c ${whereClause} ${orderClause}`;

      const querySpec: SqlQuerySpec = {
        query,
        parameters
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();

      // Calculate next cursor
      const hasMore = resources.length === pagination.limit;
      const nextCursor = hasMore ? ((parseInt(pagination.cursor || '0')) + pagination.limit).toString() : undefined;

      return {
        opportunities: resources,
        nextCursor,
        hasMore,
        total: resources.length
      };

    } catch (error) {
      console.error('Error fetching opportunities:', error);
      throw error;
    }
  }

  /**
   * Get filter options for the UI
   */
  async getFilterOptions() {
    try {
      const query = `
        SELECT DISTINCT 
          c.source,
          c.status,
          c.primaryNAICS.id as naicsId,
          c.classificationCodeDesc as psc,
          c.searchTerm
        FROM c
      `;

      const { resources } = await this.container.items.query(query).fetchAll();

      const sources = [...new Set(resources.map(r => r.source).filter(Boolean))];
      const status = [...new Set(resources.map(r => r.status).filter(Boolean))];
      const naics = [...new Set(resources.map(r => r.naicsId).filter(Boolean))];
      const psc = [...new Set(resources.map(r => r.psc).filter(Boolean))];
      const searchTerms = [...new Set(resources.map(r => r.searchTerm).filter(Boolean))];

      return {
        sources: sources.sort(),
        status: status.sort(),
        naics: naics.sort(),
        psc: psc.sort(),
        searchTerms: searchTerms.sort()
      };
    } catch (error) {
      console.error('Error fetching filter options:', error);
      throw error;
    }
  }
  /**
   * Toggle pursue status for opportunity
   */
  async toggleOpportunityPursued(opportunityId: string, userId: string): Promise<boolean> {
    try {
      const opportunity = await this.findOpportunityWithCorrectPartition(opportunityId);

      // Initialize fields if they don't exist
      opportunity.seenBy = opportunity.seenBy || {};
      
      // Toggle pursued status
      const isCurrentlyPursued = opportunity.pursued === true;
      opportunity.pursued = !isCurrentlyPursued;
      
      // Mark as seen when pursuing
      if (!isCurrentlyPursued) {
        opportunity.seenBy[userId] = new Date().toISOString();
      }

      // Use the opportunity's actual partition key for the update
      const partitionKey = opportunity.partitionKey || opportunity.partitionDate?.split('T')[0] || new Date().toISOString().split('T')[0];
      
      await this.container.item(opportunityId, partitionKey).replace(opportunity);
      return !isCurrentlyPursued; // Return new pursued state
    } catch (error) {
      console.error('Error toggling opportunity pursued state:', error);
      return false;
    }
  }

  /**
   * Get all pursued opportunities for a user (for copy list functionality)
   */
  async getPursuedOpportunities(userId: string) {
    try {
      const querySpec = {
        query: 'SELECT c.id, c.title, c.solicitationNumber FROM c WHERE c.pursued = true AND ARRAY_CONTAINS(c.userSaves, @userId)',
        parameters: [{ name: '@userId', value: userId }]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      return resources;
    } catch (error) {
      console.error('Error fetching pursued opportunities:', error);
      throw error;
    }
  }

  /**
   * Bulk pursue all saved opportunities for a user
   */
  async bulkPursueOpportunities(userId: string): Promise<number> {
    try {
      // First, get all saved opportunities for this user
      const querySpec = {
        query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.userSaves, @userId) AND (NOT IS_DEFINED(c.pursued) OR c.pursued != true)',
        parameters: [{ name: '@userId', value: userId }]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      
      let updatedCount = 0;
      
      // Update each opportunity
      for (const opportunity of resources) {
        try {
          opportunity.pursued = true;
          opportunity.seenBy = opportunity.seenBy || {};
          opportunity.seenBy[userId] = new Date().toISOString();
          
          const partitionKey = opportunity.partitionKey || opportunity.partitionDate?.split('T')[0] || new Date().toISOString().split('T')[0];
          await this.container.item(opportunity.id, partitionKey).replace(opportunity);
          updatedCount++;
        } catch (itemError) {
          console.error(`Error updating opportunity ${opportunity.id}:`, itemError);
          // Continue with other opportunities
        }
      }

      return updatedCount;
    } catch (error) {
      console.error('Error bulk pursuing opportunities:', error);
      throw error;
    }
  }
}

// Singleton instance
export const cosmosService = new CosmosService();