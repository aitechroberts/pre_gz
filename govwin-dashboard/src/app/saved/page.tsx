'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, DollarSign, Calendar, RefreshCw, ArrowLeft } from 'lucide-react';
import { OpportunityCard } from '@/components/opportunities/opportunity-card';
import { OpportunityFiltersComponent } from '@/components/opportunities/opportunity-filters';
import { useOpportunities } from '@/hooks/use-opportunities';
import { useOpportunityStats } from '@/hooks/use-opportunity-stats';
import { OpportunityFilters, SortParams, PARKER_TIDE_NAICS, PARKER_TIDE_PSC } from '@/lib/types';
import { format } from 'date-fns';
import { AuthGuard } from '@/components/auth/auth-guard';
import { useAuth } from '@/components/providers/auth-provider';
import { useBulkPursue, useGetPursuedList } from '@/hooks/use-user-actions';
import { Copy, Plus } from 'lucide-react';
import Link from 'next/link';

// UI Pagination Hook (EXACT copy from dashboard)
function useUIPagination({ data, itemsPerPage }: { data: any[]; itemsPerPage: number }) {
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedData = useMemo(() => {
    const startIndex = 0;
    const endIndex = currentPage * itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const hasMore = currentPage < totalPages;

  const loadMore = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const reset = () => {
    setCurrentPage(1);
  };

  return {
    currentData: paginatedData,
    totalItems: data.length,
    loadedItems: paginatedData.length,
    hasMore,
    loadMore,
    reset,
    currentPage,
    totalPages
  };
}

function SavedOpportunitiesContent() {
  const { user } = useAuth(); // Get the real authenticated user
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  // Use real user ID from authentication
  const userId = user?.homeAccountId || user?.localAccountId || 'anonymous';
  
  // Default filters with Parker Tide NAICS/PSC (EXACT same structure as dashboard)
  const defaultFilters: OpportunityFilters = {
    dateRange: {
      from: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      to: new Date()
    },
    sources: [],
    naics: [...PARKER_TIDE_NAICS], // Default to Parker Tide NAICS
    psc: [...PARKER_TIDE_PSC], // Default to Parker Tide PSC
    status: [],
    searchTerms: [],
    seenFilter: [],
    relevantFilter: ['Saved'], // ← ONLY DIFFERENCE: Default to ["Saved"] array
  };

  // Draft filters (what user is editing - doesn't trigger API calls)
  const [draftFilters, setDraftFilters] = useState<OpportunityFilters>(defaultFilters);
  
  // Applied filters (what actually drives the API calls)
  const [appliedFilters, setAppliedFilters] = useState<OpportunityFilters>(defaultFilters);

  const [sort, setSort] = useState<SortParams>({
    field: 'ingestedAt',
    direction: 'desc'
  });

  const {
    data,
    isLoading,
    error,
    refetch
  } = useOpportunities({ filters: appliedFilters, sort, limit: 10000 });

  // Pursue functionality (additional to dashboard)
  const bulkPursue = useBulkPursue();
  const { data: pursuedData } = useGetPursuedList(userId);

  // Flatten all opportunities from all pages
  const allOpportunities = data?.pages.flatMap(page => page.data?.opportunities || []) || [];

  const stats = useOpportunityStats({ opportunities: allOpportunities });

  // Use UI pagination to show 100 at a time
  const {
    currentData: displayedOpportunities,
    totalItems,
    loadedItems,
    hasMore,
    loadMore,
    reset
  } = useUIPagination({
    data: allOpportunities,
    itemsPerPage: 100
  });

  // Additional pursue-specific data
  const pursuedOpportunities = allOpportunities.filter(opp => opp.pursued === true);

  const handleCardToggle = (opportunityId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(opportunityId)) {
        newSet.delete(opportunityId);
      } else {
        newSet.add(opportunityId);
      }
      return newSet;
    });
  };

  const handleSortChange = (value: string) => {
    const [field, direction] = value.split('-') as [SortParams['field'], SortParams['direction']];
    setSort({ field, direction });
  };

  // Function to apply the draft filters
  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    reset(); // Reset pagination when filters change
  };

  // Function to reset filters (but keep relevantFilter as ['saved'])
  const handleResetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    reset(); // Reset pagination
  };

  // Additional pursue functionality
  const handleCopyPursuedList = async () => {
    const pursuedIds = pursuedOpportunities.map(opp => opp.id).join(', ');
    
    if (pursuedIds) {
      await navigator.clipboard.writeText(pursuedIds);
      // Could add toast notification here
    }
  };

  const handleBulkPursue = () => {
    bulkPursue.mutate({ userId });
  };

  const formatCurrency = (value: number) => {
    const actualValue = value * 1000; // Convert from thousands
    if (actualValue >= 1000000000) {
      return `$${(actualValue / 1000000000).toFixed(1)}B`;
    } else if (actualValue >= 1000000) {
      return `$${(actualValue / 1000000).toFixed(1)}M`;
    } else if (actualValue >= 1000) {
      return `$${(actualValue / 1000).toFixed(1)}K`;
    }
    return `$${actualValue.toLocaleString()}`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <h2 className="text-red-800 font-semibold mb-2">Error Loading Opportunities</h2>
              <p className="text-red-600 mb-4">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header (modified from dashboard) */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <ArrowLeft size={16} />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  📑 Saved Opportunities
                </h1>
                <p className="text-gray-600 text-sm">
                  Showing opportunities discovered between {format(appliedFilters.dateRange.from, 'MMM d')} - {format(appliedFilters.dateRange.to, 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Badge variant="outline">
                Last updated: {format(new Date(), 'HH:mm')}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar (EXACT same as dashboard) */}
          <div className="lg:col-span-1">
            {/* Additional pursue action buttons (only on saved page) */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Pursue Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={handleCopyPursuedList}
                  disabled={pursuedOpportunities.length === 0}
                  className="w-full flex items-center gap-2"
                  size="sm"
                >
                  <Copy size={16} />
                  Copy Pursued List ({pursuedOpportunities.length})
                </Button>
                
                <Button 
                  onClick={handleBulkPursue}
                  disabled={bulkPursue.isPending || allOpportunities.length === 0}
                  variant="outline"
                  className="w-full flex items-center gap-2"
                  size="sm"
                >
                  <Plus size={16} />
                  {bulkPursue.isPending ? 'Processing...' : 'Add All to Pursued'}
                </Button>
              </CardContent>
            </Card>

            <OpportunityFiltersComponent
              filters={draftFilters}
              onFiltersChange={setDraftFilters}
              onApplyFilters={handleApplyFilters}
              onResetFilters={handleResetFilters}
              className="sticky top-6"
            />
          </div>

          {/* Main Content (EXACT same as dashboard) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Total Opportunities (Large Font) */}
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-600">
                {totalItems.toLocaleString()} Opportunities Found
              </p>
            </div>

            {/* Statistics Cards (EXACT same as dashboard) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Opportunities</p>
                      <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Value</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg. Value</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.avgValue)}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Controls - Thinner with loading indicator (EXACT same as dashboard) */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">Sort by:</span>
                    <Select value={`${sort.field}-${sort.direction}`} onValueChange={handleSortChange}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ingestedAt-desc">Newest First</SelectItem>
                        <SelectItem value="ingestedAt-asc">Oldest First</SelectItem>
                        <SelectItem value="contractValue-desc">Highest Value</SelectItem>
                        <SelectItem value="contractValue-asc">Lowest Value</SelectItem>
                        <SelectItem value="originalPostedDt-desc">Recently Posted</SelectItem>
                        <SelectItem value="responseDate-asc">Due Date (Soon)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Small loading indicator */}
                    {isLoading && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading...</span>
                      </div>
                    )}
                    
                    <div className="text-sm text-gray-600">
                      Showing {loadedItems.toLocaleString()} of {totalItems.toLocaleString()} opportunities
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Opportunities List (EXACT same as dashboard, except OpportunityCard props) */}
            <div className="space-y-4">
              {displayedOpportunities.length === 0 && !isLoading ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <div className="text-gray-400 mb-4">
                      <TrendingUp className="h-12 w-12 mx-auto" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No opportunities found</h3>
                    <p className="text-gray-500">
                      Try adjusting your filters or date range to see more results.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {displayedOpportunities.map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      userId={userId}  // Same as dashboard
                      isExpanded={expandedCards.has(opportunity.id)}
                      onToggleExpanded={() => handleCardToggle(opportunity.id)}
                      showSeenTracking={false}    // ← Different: Don't track seen on saved page
                      showPursueButton={true}     // ← Different: Show pursue button instead of save
                      pageType="saved"            // ← Different: Configure for saved page
                    />
                  ))}

                  {/* Load More Button (EXACT same as dashboard) */}
                  {hasMore && (
                    <div className="flex justify-center pt-6">
                      <Button
                        onClick={loadMore}
                        variant="outline"
                        size="lg"
                      >
                        Load More Opportunities (Next 100)
                      </Button>
                    </div>
                  )}

                  {/* All loaded message (EXACT same as dashboard) */}
                  {!hasMore && totalItems > 0 && (
                    <div className="text-center mt-6 text-gray-600">
                      All {totalItems.toLocaleString()} opportunities loaded
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SavedOpportunitiesPage() {
  return (
    <AuthGuard>
      <SavedOpportunitiesContent />
    </AuthGuard>
  );
}