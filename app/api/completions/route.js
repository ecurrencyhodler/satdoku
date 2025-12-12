import { NextResponse } from 'next/server';
import { saveCompletion } from '../../../lib/redis.js';

/**
 * POST /api/completions
 * Save a game completion to Redis
 * Body: { sessionId: string, score: number, difficulty: string }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId, score, difficulty } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (score === undefined || score === null) {
      return NextResponse.json(
        { error: 'score is required' },
        { status: 400 }
      );
    }

    if (!difficulty) {
      return NextResponse.json(
        { error: 'difficulty is required' },
        { status: 400 }
      );
    }

    const success = await saveCompletion(sessionId, score, difficulty);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to save completion' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[completions] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
