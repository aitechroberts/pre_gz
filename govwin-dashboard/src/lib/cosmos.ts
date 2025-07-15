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


  // ... [previous methods remain the same: getOpportunities, buildQuery, etc.] ...

  /**
   * 🆕 NEW: Mark opportunity as viewed by user
   */
  /**
   * Mark opportunity as viewed by user
   */
  async markOpportunitySeen(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
    try {
      // Use partitionDate directly - no query needed!
      const { resource: opportunity } = await this.container.item(opportunityId, partitionDate).read();
      
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }

      opportunity.seenBy = opportunity.seenBy || {};
      opportunity.seenBy[userId] = new Date().toISOString();

      await this.container.item(opportunityId, partitionDate).replace(opportunity);
      return true;
    } catch (error) {
      console.error('Error marking opportunity as seen:', error);
      return false;
    }
  }

  /**
   * Save/unsave opportunity for user (independent of archiving)
   */
  async toggleOpportunitySaved(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
    try {
      // Use partitionDate directly - no query needed!
      const { resource: opportunity } = await this.container.item(opportunityId, partitionDate).read();
      
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }
      
      // Initialize fields if they don't exist
      opportunity.userSaves = opportunity.userSaves || [];
      opportunity.seenBy = opportunity.seenBy || {};
      
      const isSaved = opportunity.userSaves.includes(userId);
      
      if (isSaved) {
        // Unsave: remove from saves list
        opportunity.userSaves = opportunity.userSaves.filter((id: string) => id !== userId);
      } else {
        // Save: add to saves list and mark as seen
        opportunity.userSaves.push(userId);
        opportunity.seenBy[userId] = new Date().toISOString();
      }

      await this.container.item(opportunityId, partitionDate).replace(opportunity);
      return !isSaved; // Return new saved state
    } catch (error) {
      console.error('Error toggling opportunity saved state:', error);
      return false;
    }
  }

  /**
   * Archive/unarchive opportunity for user (independent of saving)
   */
  async toggleOpportunityArchived(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
    try {
      // Use partitionDate directly - no query needed!
      const { resource: opportunity } = await this.container.item(opportunityId, partitionDate).read();
      
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }
      
      // Initialize fields if they don't exist
      opportunity.archived = opportunity.archived || {};
      opportunity.seenBy = opportunity.seenBy || {};
      
      const isArchived = opportunity.archived[userId] != null;
      
      if (isArchived) {
        // Unarchive: remove from archived object
        delete opportunity.archived[userId];
      } else {
        // Archive: add to archived object and mark as seen
        opportunity.archived[userId] = new Date().toISOString();
        opportunity.seenBy[userId] = new Date().toISOString();
      }

      await this.container.item(opportunityId, partitionDate).replace(opportunity);
      return !isArchived; // Return new archived state
    } catch (error) {
      console.error('Error toggling opportunity archived state:', error);
      return false;
    }
  }

  /**
   * Pursue/unpursue opportunity for user
   */
  async toggleOpportunityPursued(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
    try {
      // Use partitionDate directly - no query needed!
      const { resource: opportunity } = await this.container.item(opportunityId, partitionDate).read();
      
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }
      
      // Initialize fields if they don't exist
      opportunity.pursued = opportunity.pursued || {};
      opportunity.seenBy = opportunity.seenBy || {};
      
      const isPursued = opportunity.pursued[userId] != null;
      
      if (isPursued) {
        // Unpursue: remove from pursued object
        delete opportunity.pursued[userId];
      } else {
        // Pursue: add to pursued object and mark as seen
        opportunity.pursued[userId] = new Date().toISOString();
        opportunity.seenBy[userId] = new Date().toISOString();
      }

      await this.container.item(opportunityId, partitionDate).replace(opportunity);
      return !isPursued; // Return new pursued state
    } catch (error) {
      console.error('Error toggling opportunity pursued state:', error);
      return false;
    }
  }

  /**
   * 🔄 LEGACY: Keep for backward compatibility
   */
  async archiveOpportunity(opportunityId: string, userId: string, partitionDate: string): Promise<boolean> {
    console.warn('archiveOpportunity is deprecated, use toggleOpportunityArchived instead');
    return this.toggleOpportunityArchived(opportunityId, userId, partitionDate);
  }

  // ... [rest of methods remain the same] ...
}

// Singleton instance
export const cosmosService = new CosmosService();