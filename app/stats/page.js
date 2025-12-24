'use client';

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

const chartConfig = {
  games: {
    label: "Games Played",
    color: "#3b82f6", // Blue color
  },
};

export default function StatsPage() {
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
    let cancelled = false; // Flag to track if this effect has been cancelled

    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/stats?timeRange=${timeRange}`);
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        
        // Only update state if this request hasn't been cancelled
        if (!cancelled) {
          setMetrics({
            gamesCompleted: data.gamesCompleted || 0,
            mistakesMade: data.mistakesMade || 0,
            chatsCompleted: data.chatsCompleted || 0,
            messagesReceived: data.messagesReceived || 0,
          });
          setChartData(data.chartData || []);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
        // Only update loading state if this request hasn't been cancelled
        if (!cancelled) {
          // Keep defaults (0 values) on error
          setLoading(false);
        }
      }
    };

    fetchStats();

    // Cleanup function to cancel the request if timeRange changes
    return () => {
      cancelled = true;
    };
  }, [timeRange]); // Re-fetch when timeRange changes

  // API already returns the correct date range, no need to filter again
  const totalGames = chartData.reduce((sum, item) => sum + item.games, 0);

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Satdoku Stats
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
            <CardDescription>Total puzzles completed</CardDescription>
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
          Total puzzles played
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
              Total puzzles
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
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillGames" x1={0} y1={0} x2={0} y2={1}>
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
