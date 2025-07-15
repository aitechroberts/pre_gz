// src/app/api/opportunities/[id]/archive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cosmosService } from '@/lib/cosmos';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await request.json();
    const { id } = await params; // ← Fix: await params first
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const archived = await cosmosService.archiveOpportunity(id, userId); // ← Use id
    
    return NextResponse.json({
      success: true,
      data: { archived }
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to archive opportunity',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}