'use client';

export default function VersusPlayerPanel({
  player,
  isYou = false,
  gameStatus,
  onNameChange,
  onReadyClick,
  compact = false
}) {
  const canEditName = isYou && gameStatus === 'waiting';
  const canStart = isYou && gameStatus === 'waiting' && !player?.ready;

  if (compact) {
    return (
      <div className={`versus-player-panel compact ${isYou ? 'you' : 'opponent'}`}>
        <div className="player-name">
          {canEditName ? (
            <input
              type="text"
              value={player?.name || ''}
              onChange={(e) => onNameChange?.(e.target.value)}
              className="name-input"
              maxLength={20}
            />
          ) : (
            <span>{player?.name || 'Player'}</span>
          )}
        </div>
        <div className="player-score">Score: {player?.score || 0}</div>
        {canStart && (
          <button onClick={onReadyClick} className="start-button">
            Start
          </button>
        )}
        {player?.ready && gameStatus === 'waiting' && (
          <div className="ready-indicator">Ready</div>
        )}
      </div>
    );
  }

  return (
    <div className={`versus-player-panel ${isYou ? 'you' : 'opponent'}`}>
      <div className="player-header">
        <div className="player-name">
          {canEditName ? (
            <input
              type="text"
              value={player?.name || ''}
              onChange={(e) => onNameChange?.(e.target.value)}
              className="name-input"
              maxLength={20}
            />
          ) : (
            <span>{player?.name || 'Player'}</span>
          )}
        </div>
        {isYou && <span className="you-badge">You</span>}
      </div>
      <div className="player-stats">
        <div className="stat">
          <span className="stat-label">Score:</span>
          <span className="stat-value">{player?.score || 0}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Lives:</span>
          <span className="stat-value">{player?.lives || 0}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Mistakes:</span>
          <span className="stat-value">{player?.mistakes || 0}</span>
        </div>
      </div>
      {canStart && (
        <button onClick={onReadyClick} className="start-button">
          Start
        </button>
      )}
      {player?.ready && gameStatus === 'waiting' && (
        <div className="ready-indicator">Ready</div>
      )}
      {player?.connected === false && (
        <div className="disconnected-indicator">Disconnected</div>
      )}
    </div>
  );
}

