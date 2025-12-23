import { createSupabaseClient } from '@/lib/supabase/client';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    
    // Calculate start date based on time range
    const startDate = new Date();
    let daysToSubtract = 30;
    if (timeRange === "7d") {
      daysToSubtract = 7;
    } else if (timeRange === "14d") {
      daysToSubtract = 14;
    }
    startDate.setDate(startDate.getDate() - daysToSubtract);
    startDate.setHours(0, 0, 0, 0); // Start of day

    const supabase = createSupabaseClient();

    // First, get conversation IDs within the time range for messages filtering
    const conversationsResult = await supabase
      .from('tutor_conversations')
      .select('conversation_id')
      .gte('started_at', startDate.toISOString());

    const conversationIds = conversationsResult.data?.map(c => c.conversation_id) || [];

    // Fetch all stats in parallel with date filtering
    const [
      gamesCompletedResult,
      mistakesResult,
      chatsCompletedResult,
      messagesResult,
      gamesPlayedResult
    ] = await Promise.all([
      // Total games completed (filtered by started_at to match games played logic)
      supabase
        .from('puzzle_completions')
        .select('id', { count: 'exact', head: true })
        .gte('started_at', startDate.toISOString()),

      // Total mistakes made (filtered by started_at to match games played logic)
      supabase
        .from('puzzle_completions')
        .select('mistakes')
        .gte('started_at', startDate.toISOString()),

      // Total chats completed (filtered by started_at)
      supabase
        .from('tutor_conversations')
        .select('id', { count: 'exact', head: true })
        .gte('started_at', startDate.toISOString()),

      // Total messages received (filtered by conversation date)
      conversationIds.length > 0
        ? supabase
            .from('tutor_messages')
            .select('user_messages')
            .in('conversation_id', conversationIds)
        : Promise.resolve({ data: [] }),

      // Games played over time (for chart) - respect timeRange
      supabase
        .from('puzzle_sessions')
        .select('started_at')
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: false })
        .limit(1000)
    ]);

    // Calculate total mistakes
    const totalMistakes = mistakesResult.data?.reduce((sum, row) => sum + (row.mistakes || 0), 0) || 0;

    // Calculate total messages
    const totalMessages = messagesResult.data?.reduce((sum, row) => sum + (row.user_messages || 0), 0) || 0;

    // Process games played data for chart (group by date)
    const gamesByDate = {};
    if (gamesPlayedResult.data) {
      gamesPlayedResult.data.forEach(session => {
        if (session.started_at) {
          const date = new Date(session.started_at);
          const dateKey = date.toISOString().split('T')[0];
          gamesByDate[dateKey] = (gamesByDate[dateKey] || 0) + 1;
        }
      });
    }

    // Generate chart data for the selected time range
    const chartData = [];
    const now = new Date();
    
    // Calculate number of days based on timeRange
    let daysToShow = 30;
    if (timeRange === "7d") {
      daysToShow = 7;
    } else if (timeRange === "14d") {
      daysToShow = 14;
    }
    
    // Generate dates from (daysToShow - 1) days ago to today (inclusive)
    // When i=0, we get today; when i=daysToShow-1, we get the oldest date
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0); // Normalize to start of day for consistent date keys
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
    return Response.json(responseData);
  } catch (error) {
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

