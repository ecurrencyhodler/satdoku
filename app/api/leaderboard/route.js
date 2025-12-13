import { NextResponse } from 'next/server';
import { getLeaderboard, checkScoreQualifies, addLeaderboardEntry } from '@/lib/redis';

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
 * If username is provided: Adds a new leaderboard entry if it qualifies
 * If username is not provided: Checks if score qualifies and returns { qualifies: true/false }
 * Body: { sessionId, score, username? }
 */
export async function POST(request) {
  try {
    const { sessionId, score, username } = await request.json();
    
    // Validate score (required for both check and submit)
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json(
        { error: 'Valid score is required' },
        { status: 400 }
      );
    }
    
    // Validate sessionId (required for both check and submit)
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    // Check if score qualifies
    const qualifies = await checkScoreQualifies(score);
    
    // If no username provided, just return qualification status
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return NextResponse.json({
        qualifies: qualifies
      });
    }
    
    // Username provided - proceed with submission
    
    if (!qualifies) {
      return NextResponse.json(
        { error: 'Score does not qualify for leaderboard', qualifies: false },
        { status: 400 }
      );
    }
    
    // Add entry and get updated leaderboard
    const updatedLeaderboard = await addLeaderboardEntry(
      sessionId,
      score,
      username.trim()
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
