import { NextResponse } from 'next/server';
import { getLeaderboard, addLeaderboardEntry } from '@/lib/redis';
import { getSessionId } from '@/lib/session/cookieSession';
import { validateCompletionForLeaderboard, markCompletionSubmitted } from '@/lib/redis/completions';

/**
 * GET /api/leaderboard
 * Returns the top 10 leaderboard entries
 */
export async function GET() {
  try {
    const leaderboard = await getLeaderboard();
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leaderboard
 * Submit a completion to the leaderboard
 * Body: { completionId: string, username: string }
 * Session derived from cookie
 */
export async function POST(request) {
  try {
    // Get session ID from cookie
    const sessionId = await getSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
    }

    const { completionId, username } = await request.json();

    // Validate completionId
    if (!completionId || typeof completionId !== 'string') {
      return NextResponse.json(
        { error: 'completionId is required' },
        { status: 400 }
      );
    }

    // Validate username
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return NextResponse.json(
        { error: 'username is required' },
        { status: 400 }
      );
    }

    // Validate username length and charset
    const trimmedUsername = username.trim();
    if (trimmedUsername.length > 50) {
      return NextResponse.json(
        { error: 'username must be 50 characters or less' },
        { status: 400 }
      );
    }

    // Validate completion
    const validation = await validateCompletionForLeaderboard(completionId, sessionId);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Completion validation failed' },
        { status: 400 }
      );
    }

    const completion = validation.completion;

    // Mark completion as submitted
    await markCompletionSubmitted(completionId);

    // Add entry to leaderboard using server-derived data only
    // Note: addLeaderboardEntry currently only accepts sessionId, score, username
    // The score is server-derived from the completion record
    const updatedLeaderboard = await addLeaderboardEntry(
      completion.sessionId,
      completion.score,
      trimmedUsername
    );

    return NextResponse.json({
      success: true,
      leaderboard: updatedLeaderboard
    });
  } catch (error) {
    console.error('Error adding leaderboard entry:', error);
    return NextResponse.json(
      { error: 'Failed to add leaderboard entry' },
      { status: 500 }
    );
  }
}
