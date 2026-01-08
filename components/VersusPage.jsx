'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVersusWebSocket } from './hooks/useVersusWebSocket.js';
import { useVersusGame } from './hooks/useVersusGame.js';
import { useVersusCellInput } from './hooks/useVersusCellInput.js';
import { useMobileDetection } from './hooks/useMobileDetection.js';
import VersusPlayerPanel from './VersusPlayerPanel.jsx';
import VersusCountdown from './VersusCountdown.jsx';
import VersusInviteUrl from './VersusInviteUrl.jsx';
import VersusNotification from './VersusNotification.jsx';
import VersusReconnecting from './VersusReconnecting.jsx';
import VersusWinModal from './Modals/VersusWinModal.jsx';
import GameBoard from './GameBoard.jsx';
import NumberPad from './NumberPad.jsx';
import NoteControls from './NoteControls.jsx';

export default function VersusPage({
  mode = 'play', // 'create' or 'play'
  roomId,
  sessionId,
  playerId,
  isSpectator = false,
  initialPlayerName = 'Player 1',
  onPlayerNameChange,
  onCreateRoom
}) {
  const [selectedCell, setSelectedCell] = useState(null);
  const [noteMode, setNoteMode] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [winStats, setWinStats] = useState(null);
  const [notification, setNotification] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [playerName, setPlayerName] = useState(initialPlayerName);
  // Only show difficulty selection if creating AND no roomId exists yet
  const [showDifficultySelection, setShowDifficultySelection] = useState(mode === 'create' && !roomId);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  
  const isMobile = useMobileDetection();
  const isLoadingStateRef = useRef(false);
  const hasSeenPlayer1ConnectedRef = useRef(false);
  const [hasJoinedRoomViaWS, setHasJoinedRoomViaWS] = useState(false);
  
  // For player1 creating a room, delay initial state load until WebSocket connects
  // For player2 joining, load immediately
  const [enableInitialLoad, setEnableInitialLoad] = useState(() => {
    return !(roomId && playerId === 'player1');
  });

  // Game state management - must be defined before WebSocket handlers so loadState is available
  // For newly created rooms (player1), delay initial state load until WebSocket connects and joins
  // This prevents the "disconnected" message from flashing
  const {
    gameState,
    loading,
    error,
    loadState,
    handleWebSocketMessage: handleWebSocketMessageFromHook,
    setGameState
  } = useVersusGame(roomId, sessionId, playerId, enableInitialLoad);


  // WebSocket connection handlers - must be defined before useVersusWebSocket hook
  const handleReconnect = useCallback(async () => {
    if (roomId) {
      return loadState();
    }
  }, [roomId, loadState]);

  // Wrap WebSocket message handler to capture notifications
  const handleWebSocketMessage = useCallback((message) => {
    // Track when player successfully joins room via WebSocket
    if (message.type === 'joined') {
      setHasJoinedRoomViaWS(true);
      // If this is player1 who hasn't loaded yet, enable loading now
      if (playerId === 'player1' && !enableInitialLoad) {
        setEnableInitialLoad(true);
      }
    }
    
    const result = handleWebSocketMessageFromHook(message);
    // If the handler returns a notification, display it
    if (result && typeof result === 'object' && result.type) {
      setNotification(result);
    }
    // Also check if message itself is a notification
    if (message.type === 'notification' && message.notification) {
      setNotification(message.notification);
    }
  }, [handleWebSocketMessageFromHook, playerId, enableInitialLoad]);

  // WebSocket connection - must be called before useEffect that uses isConnected
  const { isConnected, isReconnecting, sendMessage } = useVersusWebSocket(
    roomId,
    sessionId,
    playerId,
    handleWebSocketMessage,
    handleReconnect
  );




  // Track if we've ever seen player1 connected for this room
  useEffect(() => {
    const player1Connected = gameState?.players?.player1?.connected === true;
    if (roomId && player1Connected && !hasSeenPlayer1ConnectedRef.current) {
      hasSeenPlayer1ConnectedRef.current = true;
      // Force a single re-render to show the game
      setShowDifficultySelection(false);
    }
  }, [roomId, gameState?.players?.player1?.connected]);

  // Reset the ref when roomId changes
  useEffect(() => {
    if (roomId) {
      // Reset for new room
      hasSeenPlayer1ConnectedRef.current = false;
    }
  }, [roomId]);

  // Reset showDifficultySelection when navigating back (roomId becomes null)
  useEffect(() => {
    if (mode === 'create' && !roomId) {
      // When user navigates back to create screen, show difficulty selection
      setShowDifficultySelection(true);
    }
  }, [mode, roomId]);

  // Cell input handling
  const { handleCellInput } = useVersusCellInput(
    roomId,
    selectedCell,
    gameState,
    setGameState,
    (stats) => {
      setWinStats({
        winner: stats.winner,
        player1: stats.player1,
        player2: stats.player2
      });
      setShowWinModal(true);
    },
    null, // onGameOver
    () => {
      // onPurchaseLife - could open purchase modal
      console.log('Open purchase modal');
    },
    () => isLoadingStateRef.current,
    noteMode
  );

  // Handle ready button click
  const handleReadyClick = useCallback(async () => {
    if (!roomId) return;

    try {
      const response = await fetch('/api/versus/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          ready: true
        })
      });

      const result = await response.json();
      if (result.success) {
        // Trigger ready check on WebSocket server
        sendMessage({ type: 'ready_check', roomId });
        // Reload state to get updated ready status
        loadState();
      }
    } catch (error) {
      console.error('Error setting ready:', error);
    }
  }, [roomId, sendMessage, loadState]);

  // Handle name change
  const handleNameChange = useCallback(async (newName) => {
    if (!roomId || !playerId) return;

    setPlayerName(newName);
    if (onPlayerNameChange) {
      onPlayerNameChange(newName);
    }

    try {
      await fetch('/api/versus/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          name: newName
        })
      });
      
      // Reload state to get updated name
      loadState();
    } catch (error) {
      console.error('Error updating name:', error);
    }
  }, [roomId, playerId, onPlayerNameChange, loadState]);

  // Handle difficulty selection and room creation
  const handleDifficultySelect = useCallback(async (selectedDifficulty) => {
    setDifficulty(selectedDifficulty);
    setHasJoinedRoomViaWS(false);
    setEnableInitialLoad(false); // Prevent loading until WebSocket connected
    // Immediately hide difficulty selection to prevent re-showing during navigation
    setShowDifficultySelection(false);
    if (onCreateRoom) {
      await onCreateRoom(selectedDifficulty, playerName);
    }
  }, [onCreateRoom, playerName]);

  // Handle cell selection
  const handleCellClick = useCallback(async (row, col) => {
    if (gameState?.gameStatus !== 'playing' || isSpectator) return;
    setSelectedCell({ row, col });

    // Broadcast cell selection via API
    if (roomId) {
      try {
        await fetch('/api/versus/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'selectCell',
            roomId,
            row,
            col
          })
        });
      } catch (error) {
        console.error('Error selecting cell:', error);
      }
    }
  }, [gameState, isSpectator, roomId]);

  // CRITICAL: If roomId exists, NEVER show difficulty selection - prevents flashing during navigation
  if (roomId) {
    // If we have a roomId but no gameState yet, return null (parent shows loading)
    if (!gameState) {
      return null;
    }
    // Continue to render game board below
  } else if (mode === 'create' && showDifficultySelection) {
    // Show difficulty selection ONLY if no roomId exists
    return (
      <div className="versus-page create-mode">
        <div className="versus-container">
          <h1>Create Versus Game</h1>
          <div className="difficulty-selection">
            <label>Your Name:</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              className="name-input"
            />
            <label>Select Difficulty:</label>
            <div className="difficulty-buttons">
              <button onClick={() => handleDifficultySelect('beginner')}>Beginner</button>
              <button onClick={() => handleDifficultySelect('medium')}>Medium</button>
              <button onClick={() => handleDifficultySelect('hard')}>Hard</button>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    // No roomId and no difficulty selection - return null
    return null;
  }

  if (error) {
    return <div className="versus-page error">Error: {error}</div>;
  }

  const isPlayer1 = playerId === 'player1';
  const isPlayer2 = playerId === 'player2';
  const player1Data = gameState?.players?.player1;
  const player2Data = gameState?.players?.player2;
  const yourData = isPlayer1 ? player1Data : isPlayer2 ? player2Data : null;
  const opponentData = isPlayer1 ? player2Data : isPlayer2 ? player1Data : null;

  // Board should only be visible when the game is playing or finished, not during waiting
  const boardVisible = gameState && (gameState.gameStatus === 'playing' || gameState.gameStatus === 'finished');
  const showCountdown = gameState?.gameStatus === 'countdown' && gameState?.countdown !== null && gameState?.countdown > 0;

  return (
    <div className={`versus-page ${isMobile ? 'mobile' : 'desktop'}`}>
      <VersusReconnecting isReconnecting={isReconnecting} />
      <VersusNotification 
        notification={notification} 
        onClose={() => setNotification(null)}
      />
      
      <header className="versus-header">
        <h1>Satdoku</h1>
      </header>

      {mode === 'create' && roomId && (
        <div className="versus-invite-section">
          <VersusInviteUrl roomUrl={`/versus?room=${roomId}`} />
        </div>
      )}

      <div className="versus-layout">
        {/* Desktop: Left panel, Board, Right panel */}
        {/* Mobile: Top (opponent), Board, Bottom (you) */}
        {!isMobile ? (
          <>
            <div className="versus-panel left">
              <VersusPlayerPanel
                player={player1Data}
                isYou={isPlayer1}
                gameStatus={gameState?.gameStatus}
                onNameChange={handleNameChange}
                onReadyClick={handleReadyClick}
                roomUrl={roomId ? `/versus?room=${roomId}` : null}
                showCopyUrl={isPlayer1}
              />
            </div>
            <div className="versus-board-container">
              {showCountdown && (
                <VersusCountdown 
                  countdown={gameState.countdown} 
                  visible={true}
                />
              )}
              {gameState ? (
                <>
                  {boardVisible ? (
                    <GameBoard
                      board={gameState.board}
                      puzzle={gameState.puzzle}
                      solution={gameState.solution}
                      selectedCell={selectedCell}
                      onCellClick={handleCellClick}
                      hasLives={yourData?.lives > 0}
                      notes={gameState.notes || []}
                      noteMode={noteMode}
                      opponentSelectedCell={gameState.opponentSelectedCell}
                    />
                  ) : (
                    <GameBoard
                      board={Array(9).fill(null).map(() => Array(9).fill(0))}
                      puzzle={Array(9).fill(null).map(() => Array(9).fill(0))}
                      solution={null}
                      selectedCell={null}
                      onCellClick={() => {}}
                      hasLives={true}
                      notes={[]}
                      noteMode={false}
                      opponentSelectedCell={null}
                    />
                  )}
                  {!isSpectator && (
                    <div className="versus-controls-container">
                      <NumberPad
                        onNumberClick={handleCellInput}
                        disabled={!selectedCell || gameState.gameStatus !== 'playing'}
                        versus={true}
                      />
                      <NoteControls
                        noteMode={noteMode}
                        onToggleNoteMode={() => setNoteMode(!noteMode)}
                        onClear={async () => {
                          if (!roomId) return;
                          try {
                            const response = await fetch('/api/versus/action', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'clearNotes',
                                roomId
                              })
                            });
                            const result = await response.json();
                            if (result.success && result.state) {
                              const { transformVersusStateToClient } = await import('../lib/game/versusGameStateClient.js');
                              const clientState = transformVersusStateToClient(result.state, playerId);
                              setGameState(clientState);
                            }
                          } catch (error) {
                            console.error('Error clearing notes:', error);
                          }
                        }}
                        disabled={gameState.gameStatus !== 'playing'}
                        versus={true}
                      />
                    </div>
                  )}
                </>
              ) : null}
            </div>
            <div className="versus-panel right">
              <VersusPlayerPanel
                player={player2Data || {
                  name: 'Player 2',
                  score: 0,
                  lives: 2,
                  ready: false,
                  connected: false
                }}
                isYou={isPlayer2}
                gameStatus={gameState?.gameStatus}
                onNameChange={handleNameChange}
                onReadyClick={handleReadyClick}
                isWaiting={!player2Data}
              />
            </div>
          </>
        ) : (
          <>
            <div className="versus-panel mobile-top">
              <VersusPlayerPanel
                player={opponentData}
                isYou={false}
                gameStatus={gameState?.gameStatus}
                compact={true}
              />
            </div>
            <div className="versus-board-container mobile">
              {showCountdown && (
                <VersusCountdown 
                  countdown={gameState.countdown} 
                  visible={true}
                />
              )}
              {gameState ? (
                <>
                  {boardVisible ? (
                    <GameBoard
                      board={gameState.board}
                      puzzle={gameState.puzzle}
                      solution={gameState.solution}
                      selectedCell={selectedCell}
                      onCellClick={handleCellClick}
                      hasLives={yourData?.lives > 0}
                      notes={gameState.notes || []}
                      noteMode={noteMode}
                      opponentSelectedCell={gameState.opponentSelectedCell}
                    />
                  ) : (
                    <GameBoard
                      board={Array(9).fill(null).map(() => Array(9).fill(0))}
                      puzzle={Array(9).fill(null).map(() => Array(9).fill(0))}
                      solution={null}
                      selectedCell={null}
                      onCellClick={() => {}}
                      hasLives={true}
                      notes={[]}
                      noteMode={false}
                      opponentSelectedCell={null}
                    />
                  )}
                  {!isSpectator && (
                    <div className="versus-controls-container">
                      <NumberPad
                        onNumberClick={handleCellInput}
                        disabled={!selectedCell || gameState.gameStatus !== 'playing'}
                        versus={true}
                      />
                      <NoteControls
                        noteMode={noteMode}
                        onToggleNoteMode={() => setNoteMode(!noteMode)}
                        onClear={async () => {
                          if (!roomId) return;
                          try {
                            const response = await fetch('/api/versus/action', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'clearNotes',
                                roomId
                              })
                            });
                            const result = await response.json();
                            if (result.success && result.state) {
                              const { transformVersusStateToClient } = await import('../lib/game/versusGameStateClient.js');
                              const clientState = transformVersusStateToClient(result.state, playerId);
                              setGameState(clientState);
                            }
                          } catch (error) {
                            console.error('Error clearing notes:', error);
                          }
                        }}
                        disabled={gameState.gameStatus !== 'playing'}
                        versus={true}
                      />
                    </div>
                  )}
                </>
              ) : null}
            </div>
            <div className="versus-panel mobile-bottom">
              <VersusPlayerPanel
                player={yourData}
                isYou={true}
                gameStatus={gameState?.gameStatus}
                onNameChange={handleNameChange}
                onReadyClick={handleReadyClick}
                compact={true}
              />
            </div>
          </>
        )}
      </div>

      <VersusWinModal
        show={showWinModal}
        winStats={winStats}
        onClose={() => setShowWinModal(false)}
      />
    </div>
  );
}
