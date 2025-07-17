// src/lib/types.ts
export interface OpportunityDocument {
  id: string;
  partitionKey: string; // e.g. "2025-01-15"
  partitionDate: string; // date-based partition key
  // Core fields
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
  classificationCodeDesc?: string;
  // Dates
  postedDate: string;
  dueDate?: string;
  ingestedAt: string;
  updateDate?: string;
  // Source info
  source: string;
  sourcePlatform: string;
  sourceURL?: string;
  solicitationNumber?: string;
  // Procurement details
  procurement?: string;
  typeOfAward?: string;
  setAsides: string[];
  competitionTypes?: string[];
  // User interaction tracking (as objects of userId->timestamp)
  userSaves: { [userId: string]: string };
  archived: { [userId: string]: string }; 
  pursued: { [userId: string]: string };
  seenBy: { [userId: string]: string };
  // (Removed old `relevant` boolean field)
  // Metadata
  searchTerm: string;
  // Optional fields
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
  seenFilter: string[];      // e.g. [] (no filter), ['seen'], or ['unseen']
  relevantFilter: string[];  // e.g. [] or any of ['saved','archived','pursued','unreviewed']
  // archivedFilter removed (use relevantFilter with 'archived' if needed)
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

export type SortField = 'postedDate' | 'contractValue' | 'dueDate' | 'ingestedAt';
export type SortDirection = 'asc' | 'desc';

export interface SortParams {
  field: SortField;
  direction: SortDirection;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface FilterOptionsResponse extends ApiResponse<FilterOptions> {}
export interface OpportunityListResponse extends ApiResponse<OpportunityResponse> {}
export interface UserActionResponse extends ApiResponse<{ updated: boolean }> {}
