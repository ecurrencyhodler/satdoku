import { NextResponse } from 'next/server';
import { saveCompletion } from '../../../lib/supabase/completions.js';
import { addLeaderboardEntry } from '../../../lib/supabase/leaderboard.js';

/**
 * POST /api/completions
 * Save a game completion to Supabase
 * Body: { sessionId: string, score: number, difficulty: string, mistakes: number }
 * Note: This route uses a simplified interface. For full completion tracking, use handleWin.js
 */
export async function POST(request) {
  let body;

  // Handle JSON parsing separately to return 400 for malformed JSON
  try {
    body = await request.json();
  } catch (error) {
    console.error('[completions] JSON parsing error:', error);
    return NextResponse.json(
      { error: 'Invalid JSON in request body', details: error.message },
      { status: 400 }
    );
  }

  // Check if body exists and is an object
  if (!body || typeof body !== 'object') {
    console.error('[completions] Invalid body type:', typeof body);
    return NextResponse.json(
      { error: 'Request body must be a JSON object' },
      { status: 400 }
    );
  }

  const { sessionId, score, difficulty, mistakes } = body;

  // Log received data for debugging
  console.log('[completions] Received:', { sessionId, score, difficulty, mistakes });

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required', received: { sessionId, score, difficulty, mistakes } },
      { status: 400 }
    );
  }

  if (score === undefined || score === null) {
    return NextResponse.json(
      { error: 'score is required', received: { sessionId, score, difficulty, mistakes } },
      { status: 400 }
    );
  }

  // Validate score is a number
  if (typeof score !== 'number' || isNaN(score) || score < 0) {
    return NextResponse.json(
      { error: 'score must be a non-negative number', received: { sessionId, score, difficulty, mistakes } },
      { status: 400 }
    );
  }

  if (!difficulty) {
    return NextResponse.json(
      { error: 'difficulty is required', received: { sessionId, score, difficulty, mistakes } },
      { status: 400 }
    );
  }

  // Validate difficulty is a string
  if (typeof difficulty !== 'string') {
    return NextResponse.json(
      { error: 'difficulty must be a string', received: { sessionId, score, difficulty, mistakes } },
      { status: 400 }
    );
  }

  // Mistakes can be 0, so only check for undefined/null
  if (mistakes === undefined || mistakes === null) {
    return NextResponse.json(
      { error: 'mistakes is required', received: { sessionId, score, difficulty, mistakes } },
      { status: 400 }
    );
  }

  // Validate mistakes is a number
  if (typeof mistakes !== 'number' || isNaN(mistakes) || mistakes < 0) {
    return NextResponse.json(
      { error: 'mistakes must be a non-negative number', received: { sessionId, score, difficulty, mistakes } },
      { status: 400 }
    );
  }

  try {
    // Create completion object matching the Supabase interface
    const completionId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const now = new Date();
    const completion = {
      completionId,
      sessionId,
      score,
      difficulty,
      mistakes,
      moves: 0, // Not provided in this route
      duration: 0, // Not provided in this route
      startedAt: now.toISOString(), // Approximate
      completedAt: now.toISOString(),
      eligibleForLeaderboard: false, // Will be checked by leaderboard system
      submittedToLeaderboard: false
    };
    const success = await saveCompletion(completion);

    if (success) {
      // Automatically add to leaderboard
      try {
        await addLeaderboardEntry(sessionId, score);
        console.log(`[completions] Added to leaderboard: sessionId=${sessionId}, score=${score}`);
      } catch (leaderboardError) {
        // Log error but don't fail the request - completion is saved
        console.error('[completions] Error adding to leaderboard (completion still saved):', leaderboardError);
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to save completion' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[completions] Error saving completion:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
