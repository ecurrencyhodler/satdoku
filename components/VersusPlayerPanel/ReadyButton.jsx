'use client';

export default function ReadyButton({
  isYou,
  player,
  gameStatus,
  isPendingReady,
  onReadyClick,
  player2Connected,
  isPlayer2Panel,
  isPlayer1Panel,
  isWaiting,
  compact
}) {
  if (!isYou && gameStatus === 'waiting' && player) {
    if (isPlayer2Panel) {
      return (
        <button className="start-button" disabled={true}>
          {player?.ready ? 'Ready' : (isWaiting === false ? 'Connected' : 'Waiting...')}
        </button>
      );
    }
    if (isPlayer1Panel) {
      return (
        <button className="start-button" disabled={true}>
          {player?.ready ? 'Ready' : (compact ? 'Challenger Connected' : 'Connected')}
        </button>
      );
    }
    return null;
  }

  if (isYou && gameStatus === 'waiting') {
    return (
      <button 
        onClick={() => {
          onReadyClick?.();
        }} 
        className={`start-button ${isPendingReady ? 'pending' : ''}`}
        disabled={player?.ready || isPendingReady || (player2Connected !== undefined && !player2Connected)}
      >
        {isPendingReady ? (
          <span className="ready-button-content">
            <span className="ready-spinner"></span>
          </span>
        ) : player?.ready ? (
          'Ready'
        ) : (
          'Start Game'
        )}
      </button>
    );
  }

  return null;
}
