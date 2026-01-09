'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVersusWebSocket } from './hooks/useVersusWebSocket.js';
import { useVersusGame } from './hooks/useVersusGame.js';
import { useVersusCellInput } from './hooks/useVersusCellInput.js';
import { useMobileDetection } from './hooks/useMobileDetection.js';
import { transformVersusStateToClient } from '../lib/game/versusGameStateClient.js';
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
  // Track which cells the current player has filled
  const playerFilledCellsRef = useRef(new Set());
  const previousBoardRef = useRef(null);
  
  // For both players, delay initial state load until WebSocket connects
  // Player1: waits for WebSocket connection before loading
  // Player2: waits for WebSocket connection before loading
  const [enableInitialLoad, setEnableInitialLoad] = useState(() => {
    // Only enable immediate load if we don't have a roomId yet (before room creation)
    return !roomId;
  });

  // Game state management - must be defined before WebSocket handlers so loadState is available
  // Delay initial state load until WebSocket connects and joins for both players
  // This prevents the "disconnected" message from flashing and ensures connection is ready
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
      // Enable loading for both players once WebSocket connection is established
      if (!enableInitialLoad) {
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
  }, [handleWebSocketMessageFromHook, enableInitialLoad]);

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
  const { handleCellInput: originalHandleCellInput } = useVersusCellInput(
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

  // Track opponent-filled cells
  const [opponentFilledCells, setOpponentFilledCells] = useState(new Set());

  // Reset player filled cells when game starts
  useEffect(() => {
    if (gameState?.gameStatus === 'playing' && previousBoardRef.current === null) {
      // Game just started, clear any previous tracking
      playerFilledCellsRef.current.clear();
    }
  }, [gameState?.gameStatus]);

  // Compute opponent-filled cells based on board state
  useEffect(() => {
    if (!gameState?.board || !gameState?.puzzle) return;

    const board = gameState.board;
    const puzzle = gameState.puzzle;
    const opponentFilled = new Set();
    const previousBoard = previousBoardRef.current;

    // Check if our last move attempt succeeded
    if (lastMoveAttemptRef.current && previousBoard) {
      const { row, col, value } = lastMoveAttemptRef.current;
      const currentValue = board[row]?.[col] ?? 0;
      const previousValue = previousBoard[row]?.[col] ?? 0;
      
      // If the cell now has the value we tried to place, it was our move
      if (currentValue === value && previousValue !== value) {
        const cellKey = `${row},${col}`;
        playerFilledCellsRef.current.add(cellKey);
      }
      
      // Clear the move attempt after processing
      lastMoveAttemptRef.current = null;
    }

    // A cell is opponent-filled if:
    // 1. It has a value (not 0)
    // 2. It's not prefilled (not in puzzle)
    // 3. It's not in the player's filled cells set
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const value = board[row]?.[col] ?? 0;
        const isPrefilled = puzzle[row]?.[col] !== 0;
        const cellKey = `${row},${col}`;
        const isInPlayerSet = playerFilledCellsRef.current.has(cellKey);
        
        if (value !== 0 && !isPrefilled && !isInPlayerSet) {
          opponentFilled.add(cellKey);
        }
      }
    }

    // Clean up: if a cell in playerFilledCellsRef is now empty, remove it
    for (const cellKey of playerFilledCellsRef.current) {
      const [row, col] = cellKey.split(',').map(Number);
      if (board[row]?.[col] === 0) {
        playerFilledCellsRef.current.delete(cellKey);
      }
    }

    setOpponentFilledCells(opponentFilled);
    previousBoardRef.current = board.map(row => [...row]);
  }, [gameState?.board, gameState?.puzzle]);

  // Track last attempted move
  const lastMoveAttemptRef = useRef(null);

  // Wrapper for handleCellInput to track player moves
  const handleCellInput = useCallback(async (value) => {
    if (!selectedCell) return;
    
    // Track the move attempt
    const cellKey = `${selectedCell.row},${selectedCell.col}`;
    lastMoveAttemptRef.current = value !== 0 ? { row: selectedCell.row, col: selectedCell.col, value } : null;
    
    // Call the original handler
    await originalHandleCellInput(value);
  }, [selectedCell, originalHandleCellInput]);

  // Track if ready request is in progress to prevent duplicate clicks
  const isReadyRequestInProgressRef = useRef(false);

  // Handle ready button click
  const handleReadyClick = useCallback(async () => {
    if (!roomId) return;
    
    // Prevent duplicate clicks while request is in progress
    if (isReadyRequestInProgressRef.current) {
      return;
    }

    // Check current ready status - if already ready, don't make another request
    const currentReady = gameState?.players?.[playerId]?.ready;
    if (currentReady) {
      return;
    }

    isReadyRequestInProgressRef.current = true;

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

      if (result.success && result.room) {
        // Update state directly from API response instead of calling loadState
        // This avoids race conditions and ensures immediate state update
        const clientState = transformVersusStateToClient(result.room, playerId);
        setGameState(clientState);

        // Trigger ready check on WebSocket server
        sendMessage({ type: 'ready_check', roomId });
      } else if (result.success) {
        // Fallback: if API doesn't return room, reload state
        await loadState();
      }
    } catch (error) {
      console.error('Error setting ready:', error);
    } finally {
      isReadyRequestInProgressRef.current = false;
    }
  }, [roomId, sendMessage, loadState, gameState, playerId, setGameState]);

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
                player2Connected={player2Data?.connected === true}
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
                      opponentFilledCells={opponentFilledCells}
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
                      opponentFilledCells={null}
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
                      opponentFilledCells={opponentFilledCells}
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
                      opponentFilledCells={null}
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
                player2Connected={isPlayer1 ? (player2Data?.connected === true) : undefined}
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
