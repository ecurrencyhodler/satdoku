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
  isWaiting = false,
  player2Connected = undefined,
  isPlayer2Panel = false,
  isPlayer1Panel = false
}) {
  const [copied, setCopied] = useState(false);
  // Initialize to empty if name is default "Player 1" or "Player 2" so placeholder shows
  const getInitialName = () => {
    if (!player?.name) return '';
    const name = player.name;
    if (name === 'Player 1' || name === 'Player 2') {
      return '';
    }
    return name;
  };
  const [localName, setLocalName] = useState(getInitialName());
  const [isPendingReady, setIsPendingReady] = useState(false);
  const prevPlayerNameRef = useRef(player?.name || '');
  const isEditingRef = useRef(false);
  
  // Determine placeholder text based on which panel this is (only for current player's own input)
  const placeholderText = isYou ? (isPlayer1Panel ? 'Player 1' : isPlayer2Panel ? 'Player 2' : '') : '';
  
  // Sync local name with prop when player name changes externally (but not while user is editing)
  useEffect(() => {
    const currentPlayerName = player?.name || '';
    if (!isEditingRef.current && prevPlayerNameRef.current !== currentPlayerName) {
      // If name is default, set to empty to show placeholder
      if (currentPlayerName === 'Player 1' || currentPlayerName === 'Player 2') {
        setLocalName('');
      } else {
        setLocalName(currentPlayerName);
      }
      prevPlayerNameRef.current = currentPlayerName;
    } else if (prevPlayerNameRef.current !== currentPlayerName) {
      // Update ref even if not syncing
      prevPlayerNameRef.current = currentPlayerName;
    }
  }, [player?.name, localName]);

  // Reset pending ready state when player becomes ready (confirmed by server)
  useEffect(() => {
    if (player?.ready) {
      setIsPendingReady(false);
    }
  }, [player?.ready]);

  // Reset pending ready state when game is no longer waiting (new game started)
  useEffect(() => {
    if (gameStatus !== 'waiting') {
      setIsPendingReady(false);
    }
  }, [gameStatus]);

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
                // Only update if name is not empty (let server use default if empty)
                const trimmedName = e.target.value.trim();
                if (trimmedName) {
                  onNameChange?.(trimmedName);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
              className="name-input"
              maxLength={20}
              placeholder={placeholderText}
            />
          ) : (
            <span>{player?.name || 'Player'}</span>
          )}
        </div>
        <div className="player-score">Score: {player?.score || 0}</div>
        <div className="player-lives">Lives: {player?.lives || 0}</div>
        <div className="player-mistakes">Mistakes: {player?.mistakes || 0}</div>
        {isYou && gameStatus === 'waiting' && (
          <button 
            onClick={() => {
              setIsPendingReady(true);
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
        )}
        {!isYou && isPlayer2Panel && gameStatus === 'waiting' && player && (
          <button 
            className="start-button"
            disabled={true}
          >
            {player?.ready ? 'Ready' : (isWaiting === false ? 'Connected' : 'Waiting...')}
          </button>
        )}
        {!isYou && isPlayer1Panel && gameStatus === 'waiting' && player && (
          <button 
            className="start-button"
            disabled={true}
          >
            {player?.ready ? 'Ready' : 'Challenger Connected'}
          </button>
        )}
        {isYou && gameStatus === 'waiting' && player2Connected === undefined && isWaiting === false && (
          <div className="versus-rules">
            <h3 className="versus-rules-title">Versus Rules</h3>
            <ol className="versus-rules-list">
              <li>Type in your name above</li>
              <li>Select a difficulty</li>
              <li>Invite a challenger by sharing a link</li>
              <li>Both players press start to play</li>
              <li>Player with more points at the end of the game wins</li>
              <li>Cells your opponent fills are highlighted in orange</li>
              <li>Buy a life with bitcoin if you run out</li>
            </ol>
          </div>
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
                // Only update if name is not empty (let server use default if empty)
                const trimmedName = e.target.value.trim();
                if (trimmedName) {
                  onNameChange?.(trimmedName);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
              className="name-input"
              maxLength={20}
              placeholder={placeholderText}
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
        <div className="stat">
          <span className="stat-label">Mistakes:</span>
          <span className="stat-value">{player?.mistakes || 0}</span>
        </div>
      </div>
      {showCopyUrl && roomUrl && (
        <button onClick={handleCopyUrl} className="copy-url-button">
          {copied ? 'Copied!' : (gameStatus === 'waiting' ? 'Invite Player' : 'Invite Spectator')}
        </button>
      )}
      {isYou && gameStatus === 'waiting' && (
        <button 
          onClick={() => {
            setIsPendingReady(true);
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
      )}
      {!isYou && isPlayer2Panel && gameStatus === 'waiting' && player && (
        <button 
          className="start-button"
          disabled={true}
        >
          {player?.ready ? 'Ready' : (isWaiting === false ? 'Connected' : 'Waiting...')}
        </button>
      )}
        {!isYou && isPlayer1Panel && gameStatus === 'waiting' && player && (
          <button 
            className="start-button"
            disabled={true}
          >
            {player?.ready ? 'Ready' : 'Connected'}
          </button>
        )}
      {isYou && gameStatus === 'waiting' && player2Connected === undefined && isWaiting === false && (
        <div className="versus-rules">
          <h3 className="versus-rules-title">Versus Rules</h3>
          <ol className="versus-rules-list">
            <li>Type in your name above</li>
            <li>Both players press start to play</li>
            <li>Player with more points at the end of the game wins</li>
            <li>Cells your opponent fills are highlighted in orange</li>
            <li>Buy a life with bitcoin if you run out</li>
            <li>Invite a spectator by sharing a link</li>
          </ol>
        </div>
      )}
      {!isWaiting && player?.connected === false && (
        <div className="disconnected-indicator">Disconnected</div>
      )}
    </div>
  );
}

