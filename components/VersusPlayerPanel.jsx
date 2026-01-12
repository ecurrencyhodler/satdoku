'use client';

import { useState, useEffect, useRef } from 'react';
import NameInput from './VersusPlayerPanel/NameInput.jsx';
import ReadyButton from './VersusPlayerPanel/ReadyButton.jsx';
import StatsDisplay from './VersusPlayerPanel/StatsDisplay.jsx';
import RulesSection from './VersusPlayerPanel/RulesSection.jsx';

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

  const nameInputProps = {
    value: localName,
    onChange: (e) => {
      setLocalName(e.target.value);
      isEditingRef.current = true;
    },
    onFocus: () => {
      isEditingRef.current = true;
    },
    onBlur: (e) => {
      isEditingRef.current = false;
      const trimmedName = e.target.value.trim();
      if (trimmedName) {
        onNameChange?.(trimmedName);
      }
    },
    placeholder: placeholderText,
    canEdit: canEditName,
    playerName: player?.name,
    compact
  };

  return (
    <div className={`versus-player-panel ${compact ? 'compact' : ''} ${isYou ? 'you' : 'opponent'}`}>
      {compact ? (
        <>
          <div className="player-name">
            <NameInput {...nameInputProps} />
          </div>
          <StatsDisplay player={player} compact={true} />
          <ReadyButton
            isYou={isYou}
            player={player}
            gameStatus={gameStatus}
            isPendingReady={isPendingReady}
            onReadyClick={() => {
              setIsPendingReady(true);
              onReadyClick?.();
            }}
            player2Connected={player2Connected}
            isPlayer2Panel={isPlayer2Panel}
            isPlayer1Panel={isPlayer1Panel}
            isWaiting={isWaiting}
            compact={true}
          />
          <RulesSection
            isYou={isYou}
            gameStatus={gameStatus}
            player2Connected={player2Connected}
            isWaiting={isWaiting}
            compact={true}
          />
        </>
      ) : (
        <>
          <div className="player-header">
            <div className="player-name">
              <NameInput {...nameInputProps} />
            </div>
          </div>
          <StatsDisplay player={player} compact={false} />
          {showCopyUrl && roomUrl && (
            <button onClick={handleCopyUrl} className="copy-url-button">
              {copied ? 'Copied!' : (gameStatus === 'waiting' ? 'Invite Player' : 'Invite Spectator')}
            </button>
          )}
          <ReadyButton
            isYou={isYou}
            player={player}
            gameStatus={gameStatus}
            isPendingReady={isPendingReady}
            onReadyClick={() => {
              setIsPendingReady(true);
              onReadyClick?.();
            }}
            player2Connected={player2Connected}
            isPlayer2Panel={isPlayer2Panel}
            isPlayer1Panel={isPlayer1Panel}
            isWaiting={isWaiting}
            compact={false}
          />
          <RulesSection
            isYou={isYou}
            gameStatus={gameStatus}
            player2Connected={player2Connected}
            isWaiting={isWaiting}
            compact={false}
          />
          {!isWaiting && player?.connected === false && (
            <div className="disconnected-indicator">Disconnected</div>
          )}
        </>
      )}
    </div>
  );
}

