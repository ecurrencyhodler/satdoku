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
 * Submit a score to the leaderboard
 * Body: { sessionId: string, score: number, username?: string }
 * Returns: { success: boolean, qualifies: boolean, message?: string }
 * 
 * If username is not provided, only checks if score qualifies.
 * If username is provided, adds entry to leaderboard with username.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId, score, username } = body;
    
    // Validate input
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'sessionId is required', success: false },
        { status: 400 }
      );
    }
    
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json(
        { error: 'Valid score is required', success: false },
        { status: 400 }
      );
    }
    
    // Check if score qualifies
    const qualifies = await checkScoreQualifies(score);
    
    if (!qualifies) {
      return NextResponse.json({
        success: false,
        qualifies: false,
        message: 'Your score is not high enough to make it to the leaderboard.'
      });
    }
    
    // If username is not provided, just return qualification status
    if (!username) {
      return NextResponse.json({
        success: true,
        qualifies: true,
        message: 'Your score qualifies for the leaderboard!'
      });
    }
    
    // Validate username if provided
    if (typeof username !== 'string' || username.trim().length === 0) {
      return NextResponse.json(
        { error: 'Valid username is required', success: false },
        { status: 400 }
      );
    }
    
    if (username.length > 20) {
      return NextResponse.json(
        { error: 'Username must be 20 characters or less', success: false },
        { status: 400 }
      );
    }
    
    // Add entry to leaderboard with username
    try {
      await addLeaderboardEntry(sessionId, score, username.trim());
      
      return NextResponse.json({
        success: true,
        qualifies: true,
        message: 'Congratulations! Your score has been added to the leaderboard!'
      });
    } catch (error) {
      // Handle case where score doesn't qualify
      if (error.message && error.message.includes('does not qualify')) {
        return NextResponse.json({
          success: false,
          qualifies: false,
          message: 'Your score is not high enough to make it to the leaderboard.'
        });
      }
      // Re-throw other errors to be handled by outer catch
      throw error;
    }
  } catch (error) {
    console.error('Error submitting score to leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to submit score to leaderboard', success: false },
      { status: 500 }
    );
  }
}
