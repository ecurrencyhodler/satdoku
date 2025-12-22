import { createSupabaseClient } from '@/lib/supabase/client';

export async function GET() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/stats/route.js:4',message:'GET /api/stats called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  try {
    const supabase = createSupabaseClient();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/stats/route.js:7',message:'Supabase client created',data:{hasClient:!!supabase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    // Fetch all stats in parallel
    const [
      gamesCompletedResult,
      mistakesResult,
      chatsCompletedResult,
      messagesResult,
      gamesPlayedResult
    ] = await Promise.all([
      // Total games completed
      supabase
        .from('puzzle_completions')
        .select('id', { count: 'exact', head: true }),
      
      // Total mistakes made
      supabase
        .from('puzzle_completions')
        .select('mistakes'),
      
      // Total chats completed
      supabase
        .from('tutor_conversations')
        .select('id', { count: 'exact', head: true }),
      
      // Total messages received (user messages)
      supabase
        .from('tutor_messages')
        .select('user_messages'),
      
      // Games played over time (for chart) - last 30 days
      supabase
        .from('puzzle_sessions')
        .select('started_at')
        .order('started_at', { ascending: false })
        .limit(1000) // Get enough data to filter by date range
    ]);

    // Calculate total mistakes
    const totalMistakes = mistakesResult.data?.reduce((sum, row) => sum + (row.mistakes || 0), 0) || 0;

    // Calculate total messages
    const totalMessages = messagesResult.data?.reduce((sum, row) => sum + (row.user_messages || 0), 0) || 0;

    // Process games played data for chart (group by date)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const gamesByDate = {};
    if (gamesPlayedResult.data) {
      gamesPlayedResult.data.forEach(session => {
        if (session.started_at) {
          const date = new Date(session.started_at);
          if (date >= thirtyDaysAgo) {
            const dateKey = date.toISOString().split('T')[0];
            gamesByDate[dateKey] = (gamesByDate[dateKey] || 0) + 1;
          }
        }
      });
    }

    // Generate chart data for last 30 days
    const chartData = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      chartData.push({
        date: dateKey,
        games: gamesByDate[dateKey] || 0
      });
    }

    const responseData = {
      gamesCompleted: gamesCompletedResult.count || 0,
      mistakesMade: totalMistakes,
      chatsCompleted: chatsCompletedResult.count || 0,
      messagesReceived: totalMessages,
      chartData: chartData
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/stats/route.js:82',message:'Stats API success',data:{gamesCompleted:responseData.gamesCompleted,chartDataLength:responseData.chartData.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return Response.json(responseData);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/stats/route.js:87',message:'Stats API error',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.error('Error fetching stats:', error);
    return Response.json(
      {
        gamesCompleted: 0,
        mistakesMade: 0,
        chatsCompleted: 0,
        messagesReceived: 0,
        chartData: []
      },
      { status: 500 }
    );
  }
}

