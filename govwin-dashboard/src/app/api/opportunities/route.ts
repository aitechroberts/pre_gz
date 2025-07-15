// app/api/opportunities/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cosmosService } from '@/lib/cosmos';
import { OpportunityFilters, PaginationParams, SortParams } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse filters
    const filters: OpportunityFilters = {
      dateRange: {
        from: new Date(searchParams.get('fromDate') || new Date(Date.now() - 24 * 60 * 60 * 1000)),
        to: new Date(searchParams.get('toDate') || new Date())
      },
      sources: searchParams.getAll('sources'),
      naics: searchParams.getAll('naics'),
      psc: searchParams.getAll('psc'),
      status: searchParams.getAll('status'),
      searchTerms: searchParams.getAll('searchTerms'),
      seenFilter: searchParams.getAll('seenFilter'),
      relevantFilter: searchParams.getAll('relevantFilter')
    };

    // Parse pagination
    const pagination: PaginationParams = {
      cursor: searchParams.get('cursor') || undefined,
      limit: parseInt(searchParams.get('limit') || '20')
    };

    // Parse sorting
    const sort: SortParams = {
      field: (searchParams.get('sortField') as any) || 'ingestedAt',
      direction: (searchParams.get('sortDirection') as any) || 'desc'
    };

    const result = await cosmosService.getOpportunities(filters, pagination, sort);
    
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch opportunities',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
