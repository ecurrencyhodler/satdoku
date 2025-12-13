import { NextResponse } from 'next/server';
import { saveCompletion } from '../../../lib/redis/completions.js';
import { addLeaderboardEntry } from '../../../lib/redis/leaderboard.js';

/**
 * POST /api/completions
 * Save a game completion to Redis
 * Body: { sessionId: string, score: number, difficulty: string, mistakes: number }
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
    const success = await saveCompletion(sessionId, score, difficulty, mistakes);
    
    if (success) {
      // Automatically add to leaderboard
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/completions/route.js:96',message:'About to call addLeaderboardEntry from completions',data:{sessionId,score,hasUsername:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        await addLeaderboardEntry(sessionId, score);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/completions/route.js:99',message:'Successfully called addLeaderboardEntry from completions',data:{sessionId,score,hasUsername:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        console.log(`[completions] Added to leaderboard: sessionId=${sessionId}, score=${score}`);
      } catch (leaderboardError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/completions/route.js:102',message:'Error adding to leaderboard from completions',data:{sessionId,score,error:leaderboardError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
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
