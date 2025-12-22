'use client';

import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
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
import Link from 'next/link';

// Dummy data for games played over the last 30 days
const generateDummyData = () => {
  const data = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Generate random games played between 50 and 300
    const games = Math.floor(Math.random() * 250) + 50;
    
    data.push({
      date: date.toISOString().split('T')[0],
      games: games,
    });
  }
  
  return data;
};

const chartData = generateDummyData();

const chartConfig = {
  games: {
    label: "Games Played",
    color: "#3b82f6", // Blue color
  },
};

export default function StatsPage() {
  const [timeRange, setTimeRange] = useState("30d");

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

  // Dummy data for metric cards
  const metrics = {
    gamesCompleted: { value: 1247, change: '12.5', trend: 'up' },
    mistakesMade: { value: 3421, change: '8.2', trend: 'down' },
    chatsCompleted: { value: 892, change: '24.3', trend: 'up' },
    messagesReceived: { value: 5432, change: '15.7', trend: 'up' },
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Statistics Dashboard
        </h1>
        <div style={{ marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            ← Back to Game
          </Link>
        </div>
      </header>

      {/* Metric Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <Card>
          <CardHeader>
            <CardDescription>Total games completed</CardDescription>
            <CardTitle>{metrics.gamesCompleted.value.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardFooter />
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total mistakes made</CardDescription>
            <CardTitle>{metrics.mistakesMade.value.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardFooter />
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total chats completed</CardDescription>
            <CardTitle>{metrics.chatsCompleted.value.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardFooter />
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total messages received</CardDescription>
            <CardTitle>{metrics.messagesReceived.value.toLocaleString()}</CardTitle>
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
          transition: 'background-color 0.2s, box-shadow 0.2s'
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
              {totalGames.toLocaleString()}
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
              type="natural"
              fill="url(#fillGames)"
              fillOpacity={0.6}
              stroke={chartConfig.games.color}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </div>
      </div>
    </div>
  );
}
