import { NextResponse } from 'next/server';
import { initializePuzzleCache } from '../../../../lib/redis/puzzleGenerator.js';
import { clearPuzzleCache } from '../../../../lib/redis/puzzleCache.js';

/**
 * POST /api/puzzle-cache/init
 * Initialize puzzle cache by pre-generating puzzles
 * Can be called on server startup or manually
 */
export async function POST(request) {
  try {
    console.log('[puzzle-cache/init] Starting cache initialization...');
    await initializePuzzleCache();
    
    return NextResponse.json({
      success: true,
      message: 'Puzzle cache initialized successfully'
    });
  } catch (error) {
    console.error('[puzzle-cache/init] Error initializing cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize puzzle cache',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/puzzle-cache/init
 * Get cache status
 */
export async function GET(request) {
  try {
    const { getAllCacheCounts } = await import('../../../../lib/redis/puzzleCache.js');
    const counts = await getAllCacheCounts();
    
    return NextResponse.json({
      success: true,
      counts
    });
  } catch (error) {
    console.error('[puzzle-cache/init] Error getting cache status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get cache status',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/puzzle-cache/init
 * Clear puzzle cache (useful after fixing puzzle generation bugs)
 * Can optionally specify a difficulty to clear only that difficulty
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get('difficulty');
    
    console.log(`[puzzle-cache/init] Clearing cache${difficulty ? ` for ${difficulty}` : ' for all difficulties'}...`);
    const result = await clearPuzzleCache(difficulty);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Cache cleared for: ${result.cleared.join(', ')}`,
        cleared: result.cleared
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to clear puzzle cache'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[puzzle-cache/init] Error clearing cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear puzzle cache',
        details: error.message
      },
      { status: 500 }
    );
  }
}
