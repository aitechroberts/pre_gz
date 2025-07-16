// lib/types.ts
// lib/types.ts - FIXED VERSION
export interface OpportunityDocument {
  id: string;
  partitionKey: string; // Date-based: "2025-01-15"
  partitionDate: string; // Date-based partition key: "2025-01-15"
  
  // Core opportunity fields
  title: string;
  status: string;
  contractValue: number;
  oppValue?: string;
  
  // Classification
  primaryNAICS: {
    id: string;
    title: string;
    sizeStandard?: string;
  };
  additionalNaics?: string[];
  allNAICSCodes: string[];
  classificationCodeDesc?: string; // PSC code
  
  // Dates
  postedDate: string;
  dueDate?: string;
  ingestedAt: string;
  updateDate?: string;
  
  // Source information
  source: string;
  sourcePlatform: string;
  sourceURL?: string;
  solicitationNumber?: string;
  
  // Procurement details
  procurement?: string;
  typeOfAward?: string;
  setAsides: string[];
  competitionTypes?: string[];
  
  // 🆕 FIXED: Consistent User interaction tracking (ALL objects with timestamps)
  userSaves: { [userId: string]: string };   // {userId: timestamp} - who bookmarked this
  archived: { [userId: string]: string };    // {userId: timestamp} - who archived this  
  pursued: { [userId: string]: string };     // {userId: timestamp} - who marked as pursued
  seenBy: { [userId: string]: string };      // {userId: timestamp} - who viewed this
  
  // 🆕 REMOVED: No longer using relevant field - use the specific fields above
  // relevant: boolean | null;  // DELETED - this was the old system
  
  // Metadata
  searchTerm: string;
  
  // Optional fields from GovWin API
  description?: string;
  agency?: string;
  officeLocation?: string;
  contactInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface FilterOptions {
  sources: string[];
  naics: string[];
  psc: string[];
  status: string[];
  searchTerms: string[];
}

export interface OpportunityFilters {
  dateRange: {
    from: Date;
    to: Date;
  };
  sources: string[];
  naics: string[];
  psc: string[];
  status: string[];
  searchTerms: string[];
  seenFilter?: 'all' | 'seen' | 'unseen';
  relevantFilter?: 'all' | 'saved' | 'archived' | 'pursued' | 'unreviewed';
  archivedFilter?: 'all' | 'archived' | 'unarchived'; // New: separate archive filter
}

export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export interface OpportunityResponse {
  opportunities: OpportunityDocument[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface UserAction {
  opportunityId: string;
  userId: string;
  action: 'view' | 'save' | 'unsave' | 'archive' | 'unarchive' | 'pursue' | 'unpursue' | 'mark_seen';
  timestamp: string;
}

// Parker Tide specific constants
export const PARKER_TIDE_NAICS = [
  "518210", "541199", "541211", "541214", "541219", "541330", "541519", 
  "541611", "541612", "541618", "541690", "541720", "541930", "541990", 
  "561110", "561311", "561312", "561320", "561410", "561421", "561431", 
  "561499", "561611", "611430"
] as const;

export const PARKER_TIDE_PSC = [
  "R406", "R408", "R418", "R499", "R607", "R699", "R707"
] as const;

export const SOURCE_MAPPING = {
  "SAM.gov": "sam.gov",
  "GSA eBuy/Task Orders": "gsa_ebuy", 
  "GovWin Tracked": "govwin_tracked",
  "State/Local Bids": "state_local",
  "Opportunity Manager": "opp_manager"
} as const;

// Utility types
export type SortField = 'postedDate' | 'contractValue' | 'dueDate' | 'ingestedAt';
export type SortDirection = 'asc' | 'desc';

export interface SortParams {
  field: SortField;
  direction: SortDirection;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface FilterOptionsResponse extends ApiResponse<FilterOptions> {}
export interface OpportunityListResponse extends ApiResponse<OpportunityResponse> {}
export interface UserActionResponse extends ApiResponse<{ updated: boolean }> {}