'use client';

import { useState, useEffect, useRef } from 'react';

export default function VersusPlayerPanel({
  player,
  isYou = false,
  gameStatus,
  onNameChange,
  onReadyClick,
  compact = false,
  roomUrl = null,
  showCopyUrl = false,
  isWaiting = false
}) {
  const [copied, setCopied] = useState(false);
  const [localName, setLocalName] = useState(player?.name || '');
  const prevPlayerNameRef = useRef(player?.name || '');
  const isEditingRef = useRef(false);
  
  // Sync local name with prop when player name changes externally (but not while user is editing)
  useEffect(() => {
    const currentPlayerName = player?.name || '';
    if (!isEditingRef.current && prevPlayerNameRef.current !== currentPlayerName) {
      setLocalName(currentPlayerName);
      prevPlayerNameRef.current = currentPlayerName;
    } else if (prevPlayerNameRef.current !== currentPlayerName) {
      // Update ref even if not syncing
      prevPlayerNameRef.current = currentPlayerName;
    }
  }, [player?.name]);

  const handleCopyUrl = async () => {
    if (!roomUrl) return;
    try {
      const fullUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}${roomUrl}`
        : roomUrl;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };
  const canEditName = isYou && gameStatus === 'waiting';
  const canStart = isYou && gameStatus === 'waiting' && !player?.ready;

  if (compact) {
    return (
      <div className={`versus-player-panel compact ${isYou ? 'you' : 'opponent'}`}>
        <div className="player-name">
          {canEditName ? (
            <input
              type="text"
              value={localName}
              onChange={(e) => {
                setLocalName(e.target.value);
                isEditingRef.current = true;
              }}
              onFocus={() => {
                isEditingRef.current = true;
              }}
              onBlur={(e) => {
                isEditingRef.current = false;
                onNameChange?.(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
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
              value={localName}
              onChange={(e) => {
                setLocalName(e.target.value);
                isEditingRef.current = true;
              }}
              onFocus={() => {
                isEditingRef.current = true;
              }}
              onBlur={(e) => {
                isEditingRef.current = false;
                onNameChange?.(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
              className="name-input"
              maxLength={20}
            />
          ) : (
            <span>{player?.name || 'Player'}</span>
          )}
        </div>
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
      </div>
      {canStart && (
        <button onClick={onReadyClick} className="start-button">
          Start
        </button>
      )}
      {showCopyUrl && gameStatus === 'waiting' && roomUrl && (
        <button onClick={handleCopyUrl} className="copy-url-button">
          {copied ? 'Copied!' : 'Invite Challenger'}
        </button>
      )}
      {isWaiting && (
        <div className="waiting-indicator">Waiting for player...</div>
      )}
      {!isWaiting && player?.ready && gameStatus === 'waiting' && (
        <div className="ready-indicator">Ready</div>
      )}
      {!isWaiting && player?.connected === false && (
        <div className="disconnected-indicator">Disconnected</div>
      )}
    </div>
  );
}

