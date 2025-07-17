// src/lib/cosmos.ts
import { CosmosClient, Container, SqlQuerySpec } from '@azure/cosmos';
import { 
  OpportunityDocument, 
  OpportunityFilters, 
  PaginationParams, 
  OpportunityResponse,
  FilterOptions,
  SortParams 
} from './types';

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
    const database = this.client.database(process.env.COSMOS_DATABASE ?? "govwin");
    this.container = database.container(process.env.COSMOS_CONTAINER ?? "opportunities_optimized");
  }

  /**
   * Get opportunities with cursor-based pagination
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
   * Build SQL query based on filters (global filters)
   */
  private buildQuery(
    filters: OpportunityFilters,
    pagination: PaginationParams,
    sort: SortParams
  ): SqlQuerySpec {
    const conditions: string[] = [];
    const parameters: any[] = [];

    // Date range (partition key optimization)
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

    // NAICS and PSC filters (OR logic within each category)
    const opportunityConditions: string[] = [];
    if (filters.naics.length > 0) {
      const naicsConditions: string[] = [];
      const primaryNaicsParams = filters.naics.map((_, i) => `@naics${i}`);
      naicsConditions.push(`c.primaryNAICS.id IN (${primaryNaicsParams.join(', ')})`);
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
    // ✅ Search-term filter (AND logic)
    if (filters.searchTerms.length > 0) {
      const termPlaceholders = filters.searchTerms
        .map((_, i) => `@searchTerm${i}`)
        .join(', ');
      // exact case-sensitive match; use CONTAINS + LOWER() for fuzzy match
      conditions.push(`c.searchTerm IN (${termPlaceholders})`);
      filters.searchTerms.forEach((term, i) => {
        parameters.push({ name: `@searchTerm${i}`, value: term.trim() });
      });
    }
    if (opportunityConditions.length > 0) {
      conditions.push(`(${opportunityConditions.join(' OR ')})`);
    }

    // Seen filter (global: any user)
    if (filters.seenFilter.length === 1) {
      const filterVal = filters.seenFilter[0];
      if (filterVal === 'seen') {
        conditions.push('IS_DEFINED(c.seenBy) AND c.seenBy != {}');
      } else if (filterVal === 'unseen') {
        conditions.push('(NOT IS_DEFINED(c.seenBy) OR c.seenBy = {})');
      }
    }

    // Relevant filter (global: saved/archived/pursued/unreviewed)
    if (filters.relevantFilter.length > 0) {
      const relevantConditions: string[] = [];
      if (filters.relevantFilter.includes('saved')) {
        relevantConditions.push('IS_DEFINED(c.userSaves) AND c.userSaves != {}');
      }
      if (filters.relevantFilter.includes('archived')) {
        relevantConditions.push('IS_DEFINED(c.archived) AND c.archived != {}');
      }
      if (filters.relevantFilter.includes('pursued')) {
        relevantConditions.push('IS_DEFINED(c.pursued) AND c.pursued != {}');
      }
      if (filters.relevantFilter.includes('unreviewed')) {
        relevantConditions.push('((NOT IS_DEFINED(c.userSaves) OR c.userSaves = {}) AND (NOT IS_DEFINED(c.archived) OR c.archived = {}) AND (NOT IS_DEFINED(c.pursued) OR c.pursued = {}))');
      }
      if (relevantConditions.length > 0) {
        conditions.push(`(${relevantConditions.join(' OR ')})`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = `ORDER BY c.${sort.field} ${sort.direction.toUpperCase()}`;
    const query = `
      SELECT * FROM c 
      ${whereClause}
      ${orderBy}
    `;
    return { query, parameters };
  }

  /**
   * Get filter options from database
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
            const { resources } = await this.container.items.query({ query }).fetchAll();
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
   * Mark opportunity as viewed by a user
   */
  async markOpportunitySeen(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
    try {
      const { resource: opportunity } = await this.container.item(opportunityId, partitionDate).read();
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }
      opportunity.seenBy = opportunity.seenBy || {};
      // Only update if the user hasn't seen it yet
      if (!opportunity.seenBy[userId]) {
        opportunity.seenBy[userId] = new Date().toISOString();
        await this.container.item(opportunityId, partitionDate).replace(opportunity);
        // (Broadcasting handled in the API route)
      }
      return true;
    } catch (error) {
      console.error('Error marking opportunity as seen:', error);
      return false;
    }
  }

  /**
   * Save/unsave opportunity for a user
   */
  async toggleOpportunitySaved(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
    try {
      const { resource: opportunity } = await this.container.item(opportunityId, partitionDate).read();
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }
      opportunity.userSaves = opportunity.userSaves || {};
      opportunity.seenBy = opportunity.seenBy || {};
      const isSaved = opportunity.userSaves[userId] != null;
      if (isSaved) {
        // Unsave: remove the user's entry
        delete opportunity.userSaves[userId];
      } else {
        // Save: add with timestamp and mark as seen
        opportunity.userSaves[userId] = new Date().toISOString();
        opportunity.seenBy[userId] = new Date().toISOString();
      }
      await this.container.item(opportunityId, partitionDate).replace(opportunity);
      // (Broadcasting handled in the API route)
      return !isSaved;
    } catch (error) {
      console.error('Error toggling opportunity saved state:', error);
      return false;
    }
  }

  /**
   * Archive/unarchive opportunity for a user
   */
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
      // (Broadcasting handled in the API route)
      return !isArchived;
    } catch (error) {
      console.error('Error toggling opportunity archived state:', error);
      return false;
    }
  }

  /**
   * Pursue/unpursue opportunity for a user
   */
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
      // (Broadcasting handled in the API route)
      return !isPursued;
    } catch (error) {
      console.error('Error toggling opportunity pursued state:', error);
      return false;
    }
  }
}
// Singleton instance
export const cosmosService = new CosmosService();
