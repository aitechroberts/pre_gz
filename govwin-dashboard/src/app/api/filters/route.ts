import { NextResponse } from 'next/server';
import { cosmosService } from '@/lib/cosmos';
import { PARKER_TIDE_NAICS, PARKER_TIDE_PSC } from '@/lib/types';

export async function GET() {
  try {
    const filterOptions = await cosmosService.getFilterOptions();
    
    // Merge with Parker Tide defaults (preferred first)
    const mergeWithPreferred = (actual: string[], preferred: readonly string[]) => {
      const merged: string[] = [];
      const seen = new Set<string>();
      
      // Add preferred values first (if they exist in actual)
      for (const val of preferred) {
        if (!seen.has(val) && actual.includes(val)) {
          merged.push(val);
          seen.add(val);
        }
      }
      
      // Add remaining actual values
      for (const val of actual) {
        if (!seen.has(val)) {
          merged.push(val);
          seen.add(val);
        }
      }
      
      return merged;
    };

    const enhancedOptions = {
      ...filterOptions,
      naics: mergeWithPreferred(filterOptions.naics, PARKER_TIDE_NAICS),
      psc: mergeWithPreferred(filterOptions.psc, PARKER_TIDE_PSC),
      // Calculate Parker Tide coverage
      parkerTideCoverage: {
        naics: {
          available: PARKER_TIDE_NAICS.filter(code => filterOptions.naics.includes(code)),
          total: PARKER_TIDE_NAICS.length
        },
        psc: {
          available: PARKER_TIDE_PSC.filter(code => filterOptions.psc.includes(code)),
          total: PARKER_TIDE_PSC.length
        }
      }
    };
    
    return NextResponse.json({
      success: true,
      data: enhancedOptions
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch filter options',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}