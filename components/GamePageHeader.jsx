'use client';

import Link from 'next/link';

export default function GamePageHeader({ gameControllerRef, gameState, openWinModal }) {
  const handleWinButtonClick = () => {
    const stats = gameControllerRef.current?.getGameStats() || {
      score: gameState?.score || 0,
      moves: gameState?.moves || 0,
      mistakes: gameState?.mistakes || 0,
      livesPurchased: 0
    };
    openWinModal(stats);
  };

  return (
    <header>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0 }}>Satdoku</h1>
        <button
          onClick={handleWinButtonClick}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#4a5568',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'all 0.2s',
            lineHeight: '1',
            position: 'absolute',
            right: 0
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#e2e8f0';
            e.target.style.color = '#2d3748';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = '#4a5568';
          }}
          aria-label="Open win modal"
        >
          ×
        </button>
      </div>
      <div style={{ marginTop: '10px' }}>
        <Link 
          href="/leaderboard" 
          style={{ 
            color: '#4299e1', 
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.color = '#3182ce'}
          onMouseLeave={(e) => e.target.style.color = '#4299e1'}
        >
          View Leaderboard →
        </Link>
      </div>
    </header>
  );
}
