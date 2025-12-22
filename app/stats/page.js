'use client';

// #region agent log
if (typeof window !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/stats/page.js:2',message:'Stats page module loading started',data:{timestamp:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{}); }
// #endregion

import { useState, useEffect } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, ResponsiveContainer } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// #region agent log
if (typeof window !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/stats/page.js:18',message:'All imports completed successfully',data:{hasChartContainer:typeof ChartContainer !== 'undefined',hasCard:typeof Card !== 'undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{}); }
// #endregion

const chartConfig = {
  games: {
    label: "Games Played",
    color: "#3b82f6", // Blue color
  },
};

export default function StatsPage() {
  // #region agent log
  if (typeof window !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/stats/page.js:25',message:'StatsPage component rendering',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{}); }
  // #endregion

  const [timeRange, setTimeRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    gamesCompleted: 0,
    mistakesMade: 0,
    chatsCompleted: 0,
    messagesReceived: 0,
  });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    // #region agent log
    if (typeof window !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/stats/page.js:38',message:'useEffect triggered, calling fetchStats',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{}); }
    // #endregion
    fetchStats();
  }, []);

  const fetchStats = async () => {
    // #region agent log
    if (typeof window !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/stats/page.js:42',message:'fetchStats called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{}); }
    // #endregion
    try {
      setLoading(true);
      // #region agent log
      if (typeof window !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/stats/page.js:45',message:'Fetching /api/stats',data:{url:'/api/stats'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{}); }
      // #endregion
      const response = await fetch('/api/stats');
      // #region agent log
      if (typeof window !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/stats/page.js:48',message:'API response received',data:{status:response.status,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{}); }
      // #endregion
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      // #region agent log
      if (typeof window !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/stats/page.js:53',message:'Stats data parsed successfully',data:{gamesCompleted:data.gamesCompleted,chartDataLength:data.chartData?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{}); }
      // #endregion
      setMetrics({
        gamesCompleted: data.gamesCompleted || 0,
        mistakesMade: data.mistakesMade || 0,
        chatsCompleted: data.chatsCompleted || 0,
        messagesReceived: data.messagesReceived || 0,
      });
      setChartData(data.chartData || []);
    } catch (error) {
      // #region agent log
      if (typeof window !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/stats/page.js:62',message:'fetchStats error',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{}); }
      // #endregion
      console.error('Error fetching stats:', error);
      // Keep defaults (0 values) on error
    } finally {
      setLoading(false);
    }
  };

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date);
    const referenceDate = new Date();
    let daysToSubtract = 30;
    if (timeRange === "7d") {
      daysToSubtract = 7;
    } else if (timeRange === "14d") {
      daysToSubtract = 14;
    }
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return date >= startDate;
  });

  const totalGames = filteredData.reduce((sum, item) => sum + item.games, 0);

  // #region agent log
  if (typeof window !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/stats/page.js:79',message:'StatsPage render',data:{loading,chartDataLength:chartData.length,hasChartContainer:typeof ChartContainer !== 'undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{}); }
  // #endregion

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Statistics Dashboard
        </h1>
      </header>

      {/* Metric Cards */}
      <div 
        className="metric-cards-container"
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 0.8fr))', 
          gap: '1rem',
          marginBottom: '2rem',
          justifyContent: 'center'
        }}
      >
        <Card>
          <CardHeader>
            <CardDescription>Total games completed</CardDescription>
            <CardTitle>{loading ? '...' : metrics.gamesCompleted.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardFooter />
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total mistakes made</CardDescription>
            <CardTitle>{loading ? '...' : metrics.mistakesMade.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardFooter />
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total chats completed</CardDescription>
            <CardTitle>{loading ? '...' : metrics.chatsCompleted.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardFooter />
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total messages received</CardDescription>
            <CardTitle>{loading ? '...' : metrics.messagesReceived.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardFooter />
        </Card>
      </div>

      {/* Chart Section */}
      <div style={{ marginTop: '2rem' }}>
        <h2 
          className="chart-section-title"
          style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            marginBottom: '1rem',
            color: '#2d3748',
            transition: 'color 0.2s'
          }}
        >
          Total games played
        </h2>

      <div 
        className="chart-card-container"
        style={{ 
          background: '#f7fafc', 
          borderRadius: '8px', 
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '2rem',
          transition: 'background-color 0.2s, box-shadow 0.2s, border-color 0.2s'
        }}
      >
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div 
              className="chart-card-label"
              style={{ 
                fontSize: '0.875rem', 
                color: '#718096', 
                marginBottom: '0.25rem',
                transition: 'color 0.2s'
              }}
            >
              Total Games
            </div>
            <div 
              className="chart-card-value"
              style={{ 
                fontSize: '2rem', 
                fontWeight: 'bold',
                color: '#2d3748',
                transition: 'color 0.2s'
              }}
            >
              {loading ? '...' : totalGames.toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setTimeRange("7d")}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: timeRange === "7d" ? '2px solid var(--primary, #0070f3)' : '1px solid var(--border, #ddd)',
                background: timeRange === "7d" ? 'var(--primary, #0070f3)' : 'transparent',
                color: timeRange === "7d" ? '#fff' : 'inherit',
                cursor: 'pointer',
              }}
            >
              Last 7 days
            </button>
            <button
              onClick={() => setTimeRange("14d")}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: timeRange === "14d" ? '2px solid var(--primary, #0070f3)' : '1px solid var(--border, #ddd)',
                background: timeRange === "14d" ? 'var(--primary, #0070f3)' : 'transparent',
                color: timeRange === "14d" ? '#fff' : 'inherit',
                cursor: 'pointer',
              }}
            >
              Last 14 days
            </button>
            <button
              onClick={() => setTimeRange("30d")}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: timeRange === "30d" ? '2px solid var(--primary, #0070f3)' : '1px solid var(--border, #ddd)',
                background: timeRange === "30d" ? 'var(--primary, #0070f3)' : 'transparent',
                color: timeRange === "30d" ? '#fff' : 'inherit',
                cursor: 'pointer',
              }}
            >
              Last 30 days
            </button>
          </div>
        </div>

        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: '300px' }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillGames" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={chartConfig.games.color}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={chartConfig.games.color}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="games"
                type="monotone"
                fill="url(#fillGames)"
                fillOpacity={0.6}
                stroke={chartConfig.games.color}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
      </div>
    </div>
  );
}
