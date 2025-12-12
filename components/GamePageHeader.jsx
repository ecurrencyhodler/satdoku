'use client';

import Link from 'next/link';

export default function GamePageHeader({ gameControllerRef, gameState, openWinModal }) {
  const handleWinModalClick = () => {
    // Get stats from game controller if available, otherwise use mock stats
    const stats = gameControllerRef?.current?.getGameStats?.() || {
      score: gameState?.score || 0,
      moves: 0,
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
          onClick={handleWinModalClick}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            padding: '0 8px',
            lineHeight: '1',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.color = '#333'}
          onMouseLeave={(e) => e.target.style.color = '#666'}
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
