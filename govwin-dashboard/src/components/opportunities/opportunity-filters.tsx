// src/components/opportunities/opportunity-filters.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RotateCcw } from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';
import { OpportunityFilters, PARKER_TIDE_NAICS, PARKER_TIDE_PSC } from '@/lib/types';
import { useFilterOptions } from '@/hooks/use-filters';
import { format } from 'date-fns';

interface OpportunityFiltersProps {
  filters: OpportunityFilters;
  onFiltersChange: (filters: OpportunityFilters) => void;
  onApplyFilters?: () => void;
  onResetFilters?: () => void;
  className?: string;
  hiddenFilters?: string[]; // NEW: List of filters to hide
}

export function OpportunityFiltersComponent({ 
  filters, 
  onFiltersChange, 
  onApplyFilters,
  onResetFilters,
  className,
  hiddenFilters = [] // NEW: Default to empty array
}: OpportunityFiltersProps) {
  const { data: filterOptions, isLoading } = useFilterOptions();

  const updateFilters = (updates: Partial<OpportunityFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  // Helper function to check if a filter should be hidden
  const isFilterHidden = (filterName: string) => {
    return hiddenFilters.includes(filterName);
  };

  if (isLoading) {
    return <div className="animate-pulse bg-gray-100 rounded-lg h-32" />;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Scrollable Filter Content */}
        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6">
          
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left h-10">
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {format(filters.dateRange.from, 'MMM d, yyyy')}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.from}
                    onSelect={(date) => date && updateFilters({
                      dateRange: { ...filters.dateRange, from: date }
                    })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left h-10">
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {format(filters.dateRange.to, 'MMM d, yyyy')}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.to}
                    onSelect={(date) => date && updateFilters({
                      dateRange: { ...filters.dateRange, to: date }
                    })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Search Terms */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Search Terms ({filters.searchTerms?.length || 0} selected)
            </Label>
            <MultiSelect
              options={filterOptions?.searchTerms || []}
              selected={filters.searchTerms || []}
              onChange={(values) => updateFilters({ searchTerms: values })}
              placeholder="All search terms"
            />
          </div>

          {/* NAICS Codes */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              NAICS Codes ({filters.naics.length} selected)
            </Label>
            <MultiSelect
              options={filterOptions?.naics || []}
              selected={filters.naics}
              onChange={(values) => updateFilters({ naics: values })}
              placeholder="Select NAICS codes..."
            />
          </div>

          {/* PSC Codes */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              PSC Codes ({filters.psc.length} selected)
            </Label>
            <MultiSelect
              options={filterOptions?.psc || []}
              selected={filters.psc}
              onChange={(values) => updateFilters({ psc: values })}
              placeholder="Select PSC codes..."
            />
          </div>

          {/* Sources */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Sources ({filters.sources.length} selected)
            </Label>
            <MultiSelect
              options={filterOptions?.sources || []}
              selected={filters.sources}
              onChange={(values) => updateFilters({ sources: values })}
              placeholder="All sources"
            />
          </div>

          {/* Status */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Status ({filters.status.length} selected)
            </Label>
            <MultiSelect
              options={filterOptions?.status || []}
              selected={filters.status}
              onChange={(values) => updateFilters({ status: values })}
              placeholder="All statuses"
            />
          </div>

          {/* User-specific filters - only show if not hidden */}
          {(!isFilterHidden('seenFilter') || !isFilterHidden('relevantFilter')) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              {/* Seen Filter */}
              {!isFilterHidden('seenFilter') && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Seen Status ({(filters.seenFilter || []).length} selected)
                  </Label>
                  <MultiSelect
                    options={['seen', 'unseen']}
                    selected={filters.seenFilter || []}
                    onChange={(values) => updateFilters({ seenFilter: values })}
                    placeholder="All opportunities"
                  />
                </div>
              )}
              
              {/* Relevant Filter */}
              {!isFilterHidden('relevantFilter') && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Review Status ({(filters.relevantFilter || []).length} selected)
                  </Label>
                  <MultiSelect
                    options={['saved', 'archived', 'unreviewed']}
                    selected={filters.relevantFilter || []}
                    onChange={(values) => updateFilters({ relevantFilter: values })}
                    placeholder="All opportunities"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Apply and Reset Buttons - only show if handlers provided */}
        {(onApplyFilters || onResetFilters) && (
          <div className="flex gap-3 mt-6 pt-4 border-t">
            {onApplyFilters && (
              <Button 
                onClick={onApplyFilters}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Apply Filters
              </Button>
            )}
            {onResetFilters && (
              <Button 
                onClick={onResetFilters}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Reset
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}