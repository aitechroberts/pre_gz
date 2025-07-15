import { NextRequest, NextResponse } from 'next/server';
import { cosmosService } from '@/lib/cosmos';

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const updatedCount = await cosmosService.bulkPursueOpportunities(userId);
    
    return NextResponse.json({
      success: true,
      data: { 
        message: `Successfully pursued ${updatedCount} opportunities`,
        updatedCount 
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to bulk pursue opportunities',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}