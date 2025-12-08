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
 * Adds a new leaderboard entry if it qualifies
 * Body: { username, score, mistakes }
 */
export async function POST(request) {
  try {
    const { username, score, mistakes } = await request.json();
    
    // Validate input
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }
    
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json(
        { error: 'Valid score is required' },
        { status: 400 }
      );
    }
    
    if (typeof mistakes !== 'number' || mistakes < 0) {
      return NextResponse.json(
        { error: 'Valid mistakes count is required' },
        { status: 400 }
      );
    }
    
    // Check if score qualifies
    const qualifies = await checkScoreQualifies(score);
    
    if (!qualifies) {
      return NextResponse.json(
        { error: 'Score does not qualify for leaderboard', qualifies: false },
        { status: 400 }
      );
    }
    
    // Add entry and get updated leaderboard
    const updatedLeaderboard = await addLeaderboardEntry(
      username.trim(),
      score,
      mistakes
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
