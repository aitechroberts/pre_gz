import { useMemo } from 'react';
import { OpportunityDocument } from '@/lib/types';

interface UseOpportunityStatsParams {
  opportunities: OpportunityDocument[];
}

export function useOpportunityStats({ opportunities }: UseOpportunityStatsParams) {
  return useMemo(() => {
    const total = opportunities.length;
    const totalValue = opportunities.reduce((sum, opp) => sum + (opp.contractValue || 0), 0);
    const avgValue = total > 0 ? totalValue / total : 0;
    
    // Status breakdown
    const statusBreakdown = opportunities.reduce((acc, opp) => {
      acc[opp.status] = (acc[opp.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Source breakdown
    const sourceBreakdown = opportunities.reduce((acc, opp) => {
      acc[opp.source] = (acc[opp.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Value ranges
    const valueRanges = {
      under100k: opportunities.filter(opp => (opp.contractValue || 0) < 100000).length,
      '100k-1m': opportunities.filter(opp => {
        const value = opp.contractValue || 0;
        return value >= 100000 && value < 1000000;
      }).length,
      '1m-10m': opportunities.filter(opp => {
        const value = opp.contractValue || 0;
        return value >= 1000000 && value < 10000000;
      }).length,
      over10m: opportunities.filter(opp => (opp.contractValue || 0) >= 10000000).length,
    };

    return {
      total,
      totalValue,
      avgValue,
      statusBreakdown,
      sourceBreakdown,
      valueRanges,
    };
  }, [opportunities]);
}