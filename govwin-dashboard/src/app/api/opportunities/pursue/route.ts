import { NextRequest, NextResponse } from 'next/server';
import { cosmosService } from '@/lib/cosmos';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const pursuedOpportunities = await cosmosService.getPursuedOpportunities(userId);
    
    return NextResponse.json({
      success: true,
      data: pursuedOpportunities
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch pursued opportunities',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}