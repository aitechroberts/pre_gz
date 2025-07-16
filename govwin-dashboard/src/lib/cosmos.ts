// lib/cosmos.ts
import { CosmosClient, Container, SqlQuerySpec } from '@azure/cosmos';
import { 
  OpportunityDocument, 
  OpportunityFilters, 
  PaginationParams, 
  OpportunityResponse,
  FilterOptions,
  SortParams 
} from './types';
import { broadcastOpportunityUpdate } from '@/app/api/ws/route';

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

  /**
   * Get opportunities with cursor-based pagination
   * Uses date-based partitioning for efficient queries
   */
  async getOpportunities(
    filters: OpportunityFilters,
    pagination: PaginationParams,
    sort: SortParams = { field: 'ingestedAt', direction: 'desc' }
  ): Promise<OpportunityResponse> {
    try {
      const query = this.buildQuery(filters, pagination, sort);
      
      console.log('Executing query:', query.query);
      console.log('Query parameters:', query.parameters);
      
      const { resources, continuationToken } = await this.container.items
        .query(query, {
          maxItemCount: pagination.limit,
          continuationToken: pagination.cursor
        })
        .fetchAll();

      console.log('Query result - resources:', resources ? resources.length : 'undefined');
      console.log('Query result - continuationToken:', continuationToken);

      // Handle case where resources is undefined
      const opportunities = resources || [];

      return {
        opportunities: opportunities as OpportunityDocument[],
        nextCursor: continuationToken,
        hasMore: !!continuationToken,
        total: opportunities.length
      };
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      throw new Error(`Failed to fetch opportunities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build SQL query based on filters
   * Optimized for date-based partitioning
   */
  private buildQuery(
    filters: OpportunityFilters,
    pagination: PaginationParams,
    sort: SortParams
  ): SqlQuerySpec {
    const conditions: string[] = [];
    const parameters: any[] = [];

    // Date range filter (partition key optimization)
    const fromDate = filters.dateRange.from.toISOString().split('T')[0];
    const toDate = filters.dateRange.to.toISOString().split('T')[0];
    
    conditions.push('c.partitionDate >= @fromDate AND c.partitionDate <= @toDate');
    parameters.push(
      { name: '@fromDate', value: fromDate },
      { name: '@toDate', value: toDate }
    );

    // Source filters (AND logic)
    if (filters.sources.length > 0) {
      const sourceParams = filters.sources.map((_, i) => `@source${i}`);
      conditions.push(`c.source IN (${sourceParams.join(', ')})`);
      filters.sources.forEach((source, i) => {
        parameters.push({ name: `@source${i}`, value: source });
      });
    }

    // Status filters (AND logic)
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

    // Seen filter
    if (filters.seenFilter && filters.seenFilter !== 'all') {
      if (filters.seenFilter === 'seen') {
        conditions.push('IS_DEFINED(c.seenBy) AND c.seenBy != {}');
      } else if (filters.seenFilter === 'unseen') {
        conditions.push('(NOT IS_DEFINED(c.seenBy) OR c.seenBy = {})');
      }
    }

    // Relevant filter (saved/archived)
    if (filters.relevantFilter && filters.relevantFilter !== 'all') {
      if (filters.relevantFilter === 'saved') {
        conditions.push('c.relevant = true');
      } else if (filters.relevantFilter === 'archived') {
        conditions.push('c.relevant = false');
      } else if (filters.relevantFilter === 'unreviewed') {
        conditions.push('(NOT IS_DEFINED(c.relevant) OR c.relevant = null)');
      }
    }

    // Build final query
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = `ORDER BY c.${sort.field} ${sort.direction.toUpperCase()}`;
    
    const query = `
      SELECT * FROM c 
      ${whereClause}
      ${orderBy}
    `;

    return {
      query,
      parameters
    };
  }

  /**
   * Get filter options from database
   * Optimized with targeted queries
   */
  async getFilterOptions(): Promise<FilterOptions> {
    try {
      const queries = {
        sources: "SELECT DISTINCT VALUE c.source FROM c WHERE IS_DEFINED(c.source)",
        naics: "SELECT DISTINCT VALUE c.primaryNAICS.id FROM c WHERE IS_DEFINED(c.primaryNAICS.id)",
        psc: "SELECT DISTINCT VALUE c.classificationCodeDesc FROM c WHERE IS_DEFINED(c.classificationCodeDesc)",
        status: "SELECT DISTINCT VALUE c.status FROM c WHERE IS_DEFINED(c.status)",
        searchTerms: "SELECT DISTINCT VALUE c.searchTerm FROM c WHERE IS_DEFINED(c.searchTerm)"
      };

      const results = await Promise.all(
        Object.entries(queries).map(async ([key, query]) => {
          try {
            const { resources } = await this.container.items
              .query({ query })
              .fetchAll();
            return [key, resources.sort()];
          } catch (error) {
            console.warn(`Failed to fetch ${key} options:`, error);
            return [key, []];
          }
        })
      );

      return Object.fromEntries(results) as FilterOptions;
    } catch (error) {
      console.error('Error fetching filter options:', error);
      throw new Error('Failed to fetch filter options');
    }
  }

/**
 * Mark opportunity as viewed by user
 */
// Updated markOpportunitySeen with WebSocket broadcasting
async markOpportunitySeen(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
  try {
    const { resource: opportunity } = await this.container.item(opportunityId, partitionDate).read();
    
    if (!opportunity) {
      throw new Error('Opportunity not found');
    }

    opportunity.seenBy = opportunity.seenBy || {};
    
    // Only update if user hasn't seen it yet
    if (!opportunity.seenBy[userId]) {
      opportunity.seenBy[userId] = new Date().toISOString();

      await this.container.item(opportunityId, partitionDate).replace(opportunity);
      
      // NEW: Broadcast the seenBy update
      broadcastOpportunityUpdate(
        opportunityId,
        partitionDate,
        'seenBy',
        opportunity.seenBy,
        userId,
        'mark_seen'
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error marking opportunity as seen:', error);
    return false;
  }
}

/**
 * Save/unsave opportunity for user - FIXED to use object format
 */
// Updated toggleOpportunitySaved with WebSocket broadcasting
async toggleOpportunitySaved(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
  try {
    const { resource: opportunity } = await this.container.item(opportunityId, partitionDate).read();
    
    if (!opportunity) {
      throw new Error('Opportunity not found');
    }
    
    // Initialize fields if they don't exist
    opportunity.userSaves = opportunity.userSaves || {};
    opportunity.seenBy = opportunity.seenBy || {};
    
    const isSaved = opportunity.userSaves[userId] != null;
    
    if (isSaved) {
      // Unsave: remove from saves object
      delete opportunity.userSaves[userId];
    } else {
      // Save: add to saves object with timestamp and mark as seen
      opportunity.userSaves[userId] = new Date().toISOString();
      opportunity.seenBy[userId] = new Date().toISOString();
    }

    await this.container.item(opportunityId, partitionDate).replace(opportunity);
    
    // NEW: Broadcast the change to all connected users
    broadcastOpportunityUpdate(
      opportunityId,
      partitionDate,
      'userSaves',
      opportunity.userSaves,
      userId,
      isSaved ? 'unsave' : 'save'
    );
    
    // Also broadcast seenBy update if user wasn't already seen
    if (!isSaved) { // Only when saving (already seen users don't need seenBy broadcast)
      broadcastOpportunityUpdate(
        opportunityId,
        partitionDate,
        'seenBy',
        opportunity.seenBy,
        userId,
        'mark_seen'
      );
    }
    
    return !isSaved;
  } catch (error) {
    console.error('Error toggling opportunity saved state:', error);
    return false;
  }
}


/**
 * Archive/unarchive opportunity for user
 */
// Updated toggleOpportunityArchived with WebSocket broadcasting
async toggleOpportunityArchived(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
  try {
    const { resource: opportunity } = await this.container.item(opportunityId, partitionDate).read();
    
    if (!opportunity) {
      throw new Error('Opportunity not found');
    }
    
    opportunity.archived = opportunity.archived || {};
    opportunity.seenBy = opportunity.seenBy || {};
    
    const isArchived = opportunity.archived[userId] != null;
    
    if (isArchived) {
      delete opportunity.archived[userId];
    } else {
      opportunity.archived[userId] = new Date().toISOString();
      opportunity.seenBy[userId] = new Date().toISOString();
    }

    await this.container.item(opportunityId, partitionDate).replace(opportunity);
    
    // NEW: Broadcast changes
    broadcastOpportunityUpdate(
      opportunityId,
      partitionDate,
      'archived',
      opportunity.archived,
      userId,
      isArchived ? 'unarchive' : 'archive'
    );
    
    broadcastOpportunityUpdate(
      opportunityId,
      partitionDate,
      'seenBy',
      opportunity.seenBy,
      userId,
      'mark_seen'
    );
    
    return !isArchived;
  } catch (error) {
    console.error('Error toggling opportunity archived state:', error);
    return false;
  }
}

/**
 * Pursue/unpursue opportunity for user
 */
// Updated toggleOpportunityPursued with WebSocket broadcasting
async toggleOpportunityPursued(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
  try {
    const { resource: opportunity } = await this.container.item(opportunityId, partitionDate).read();
    
    if (!opportunity) {
      throw new Error('Opportunity not found');
    }
    
    opportunity.pursued = opportunity.pursued || {};
    opportunity.seenBy = opportunity.seenBy || {};
    
    const isPursued = opportunity.pursued[userId] != null;
    
    if (isPursued) {
      delete opportunity.pursued[userId];
    } else {
      opportunity.pursued[userId] = new Date().toISOString();
      opportunity.seenBy[userId] = new Date().toISOString();
    }

    await this.container.item(opportunityId, partitionDate).replace(opportunity);
    
    // NEW: Broadcast changes
    broadcastOpportunityUpdate(
      opportunityId,
      partitionDate,
      'pursued',
      opportunity.pursued,
      userId,
      isPursued ? 'unpursue' : 'pursue'
    );
    
    broadcastOpportunityUpdate(
      opportunityId,
      partitionDate,
      'seenBy',
      opportunity.seenBy,
      userId,
      'mark_seen'
    );
    
    return !isPursued;
  } catch (error) {
    console.error('Error toggling opportunity pursued state:', error);
    return false;
  }
}
}
// Singleton instance
export const cosmosService = new CosmosService();