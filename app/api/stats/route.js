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

    // Fetch all stats in parallel with date filtering
    const [
      soloPuzzlesPlayedResult,
      soloPuzzlesCompletedResult,
      versusPuzzlesPlayedResult,
      versusPuzzlesCompletedResult,
      soloGamesPlayedResult,
      versusGamesPlayedResult
    ] = await Promise.all([
      // Solo puzzles played - count puzzle_sessions where room_id IS NULL
      supabase
        .from('puzzle_sessions')
        .select('id', { count: 'exact', head: true })
        .is('room_id', null)
        .gte('started_at', startDate.toISOString()),

      // Solo puzzles completed - count puzzle_sessions where status='completed' and room_id IS NULL
      supabase
        .from('puzzle_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .is('room_id', null)
        .gte('started_at', startDate.toISOString()),

      // Versus puzzles played - count versus_rooms where start_at is set
      supabase
        .from('versus_rooms')
        .select('room_id', { count: 'exact', head: true })
        .not('start_at', 'is', null)
        .gte('start_at', startDate.toISOString()),

      // Versus puzzles completed - count versus_rooms where status = 'finished'
      supabase
        .from('versus_rooms')
        .select('room_id', { count: 'exact', head: true })
        .eq('status', 'finished')
        .gte('start_at', startDate.toISOString()),

      // Solo games played over time (for chart) - respect timeRange
      supabase
        .from('puzzle_sessions')
        .select('started_at')
        .is('room_id', null)
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: false })
        .limit(1000),

      // Versus games played over time (for chart) - respect timeRange
      supabase
        .from('versus_rooms')
        .select('start_at')
        .not('start_at', 'is', null)
        .gte('start_at', startDate.toISOString())
        .order('start_at', { ascending: false })
        .limit(1000)
    ]);

    // Process solo games played data for chart (group by date)
    const soloGamesByDate = {};
    if (soloGamesPlayedResult.data) {
      soloGamesPlayedResult.data.forEach(session => {
        if (session.started_at) {
          const date = new Date(session.started_at);
          const dateKey = date.toISOString().split('T')[0];
          soloGamesByDate[dateKey] = (soloGamesByDate[dateKey] || 0) + 1;
        }
      });
    }

    // Process versus games played data for chart (group by date)
    const versusGamesByDate = {};
    if (versusGamesPlayedResult.data) {
      versusGamesPlayedResult.data.forEach(room => {
        if (room.start_at) {
          const date = new Date(room.start_at);
          const dateKey = date.toISOString().split('T')[0];
          versusGamesByDate[dateKey] = (versusGamesByDate[dateKey] || 0) + 1;
        }
      });
    }

    // Generate chart data for the selected time range (combined solo + versus)
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
      const solo = soloGamesByDate[dateKey] || 0;
      const versus = versusGamesByDate[dateKey] || 0;
      chartData.push({
        date: dateKey,
        total: solo + versus
      });
    }

    const responseData = {
      soloPuzzlesPlayed: soloPuzzlesPlayedResult.count || 0,
      soloPuzzlesCompleted: soloPuzzlesCompletedResult.count || 0,
      versusPuzzlesPlayed: versusPuzzlesPlayedResult.count || 0,
      versusPuzzlesCompleted: versusPuzzlesCompletedResult.count || 0,
      chartData: chartData
    };
    return Response.json(responseData);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return Response.json(
      {
        soloPuzzlesPlayed: 0,
        soloPuzzlesCompleted: 0,
        versusPuzzlesPlayed: 0,
        versusPuzzlesCompleted: 0,
        chartData: []
      },
      { status: 500 }
    );
  }
}

