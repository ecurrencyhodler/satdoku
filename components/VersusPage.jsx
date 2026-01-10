'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVersusWebSocket } from './hooks/useVersusWebSocket.js';
import { useVersusGame } from './hooks/useVersusGame.js';
import { useVersusCellInput } from './hooks/useVersusCellInput.js';
import { useMobileDetection } from './hooks/useMobileDetection.js';
import { useVersusCountdown } from './hooks/useVersusCountdown.js';
import { transformVersusStateToClient } from '../lib/game/versusGameStateClient.js';
import VersusPlayerPanel from './VersusPlayerPanel.jsx';
import VersusCountdown from './VersusCountdown.jsx';
import VersusInviteUrl from './VersusInviteUrl.jsx';
import VersusNotification from './VersusNotification.jsx';
import VersusReconnecting from './VersusReconnecting.jsx';
import VersusWinModal from './Modals/VersusWinModal.jsx';
import VersusPurchaseLifeModal from './Modals/VersusPurchaseLifeModal.jsx';
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
  const [notification, setNotification] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  // Initialize to empty if default so placeholder shows
  const [playerName, setPlayerName] = useState(initialPlayerName === 'Player 1' ? '' : initialPlayerName);
  // Only show difficulty selection if creating AND no roomId exists yet
  const [showDifficultySelection, setShowDifficultySelection] = useState(mode === 'create' && !roomId);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  // Win modal state
  const [showWinModal, setShowWinModal] = useState(false);
  const [winStats, setWinStats] = useState(null);
  const [hasDismissedWinModal, setHasDismissedWinModal] = useState(false);
  // Purchase life modal state
  const [showPurchaseLifeModal, setShowPurchaseLifeModal] = useState(false);
  
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
        // Explicitly load state for player 2 when they first join
        // This ensures gameState is populated so controls are visible
        loadState();
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
  }, [handleWebSocketMessageFromHook, enableInitialLoad, loadState]);

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
      // Reset win modal dismissed state for new game
      setHasDismissedWinModal(false);
      setShowWinModal(false);
    }
  }, [roomId]);

  // Reset showDifficultySelection when navigating back (roomId becomes null)
  useEffect(() => {
    if (mode === 'create' && !roomId) {
      // When user navigates back to create screen, show difficulty selection
      setShowDifficultySelection(true);
    }
  }, [mode, roomId]);

  // Detect game completion and show win modal
  useEffect(() => {
    if (gameState?.status === 'finished' && gameState?.winner && !showWinModal && !hasDismissedWinModal) {
      // Build win stats
      const winStatsData = {
        winner: gameState.winner,
        player1: gameState.players?.player1,
        player2: gameState.players?.player2
      };
      setWinStats(winStatsData);
      setShowWinModal(true);
    }
  }, [gameState?.status, gameState?.winner, showWinModal, hasDismissedWinModal]);

  // Cell input handling
  const { handleCellInput: originalHandleCellInput } = useVersusCellInput(
    roomId,
    selectedCell,
    gameState,
    setGameState,
    null, // onWin - win modal removed
    null, // onGameOver
    () => {
      // onPurchaseLife - open purchase modal
      setShowPurchaseLifeModal(true);
    },
    () => isLoadingStateRef.current,
    noteMode
  );

  // Track opponent-filled cells
  const [opponentFilledCells, setOpponentFilledCells] = useState(new Set());
  // Store the initial board at game start for comparison
  const initialBoardRef = useRef(null);

  // Calculate countdown from start_at timestamp using the hook
  // MUST be called before any conditional returns to follow Rules of Hooks
  const { countdown: calculatedCountdown, isActive: countdownFinished } = useVersusCountdown(gameState?.start_at);
  
  // Track when start_at changes
  useEffect(() => {
    // start_at changes are handled by useVersusCountdown hook
  }, [gameState?.start_at, playerId, calculatedCountdown, countdownFinished]);


  // Reset player filled cells when game starts
  useEffect(() => {
    const currentStatus = gameState?.status || gameState?.gameStatus;
    if ((currentStatus === 'active' || currentStatus === 'playing') && previousBoardRef.current === null) {
      // Game just started, clear any previous tracking
      playerFilledCellsRef.current.clear();
    }
  }, [gameState?.gameStatus]);

  // Compute opponent-filled cells based on board state
  // A cell is opponent-filled if:
  // 1. It has a value (not 0)
  // 2. It's not prefilled (not in puzzle)
  // 3. It's NOT in our player-filled cells set
  // Spectators should never see orange cells, so skip this computation for them
  useEffect(() => {
    // Spectators should never see opponent-filled cells
    if (isSpectator) {
      setOpponentFilledCells(new Set());
      return;
    }

    if (!gameState?.board || !gameState?.puzzle) return;

    const board = gameState.board;
    const puzzle = gameState.puzzle;
    const opponentFilled = new Set();

    // Check if our last move attempt succeeded and add it to our filled cells
    if (lastMoveAttemptRef.current && previousBoardRef.current) {
      const { row, col, value } = lastMoveAttemptRef.current;
      const currentValue = board[row]?.[col] ?? 0;
      const previousValue = previousBoardRef.current[row]?.[col] ?? 0;
      
      // If the cell now has the value we tried to place, it was our move
      if (currentValue === value && previousValue !== value) {
        const cellKey = `${row},${col}`;
        playerFilledCellsRef.current.add(cellKey);
      }
    }

    // Clean up: if a cell in our filled set is now empty or changed, remove it
    for (const cellKey of playerFilledCellsRef.current) {
      const [row, col] = cellKey.split(',').map(Number);
      const currentValue = board[row]?.[col] ?? 0;
      // Remove if cell is now empty or doesn't match what we placed
      if (currentValue === 0) {
        playerFilledCellsRef.current.delete(cellKey);
      }
    }

    // Now identify opponent-filled cells
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const value = board[row]?.[col] ?? 0;
        const puzzleValue = puzzle[row]?.[col] ?? 0;
        const cellKey = `${row},${col}`;
        
        // A cell is opponent-filled if:
        // 1. It has a value
        // 2. It's not from the puzzle (prefilled)
        // 3. It's NOT in our filled cells set
        if (value !== 0 && puzzleValue === 0 && !playerFilledCellsRef.current.has(cellKey)) {
          opponentFilled.add(cellKey);
        }
      }
    }

    setOpponentFilledCells(opponentFilled);
    previousBoardRef.current = board.map(row => [...row]);
  }, [gameState?.board, gameState?.puzzle, isSpectator]);

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

  // Erase button handler - clears selected cell with mistake or all notes
  const handleErase = useCallback(async () => {
    if (!roomId) return;
    
    // Check if we should clear selected cell with mistake
    if (selectedCell && gameState) {
      const row = selectedCell.row;
      const col = selectedCell.col;
      const currentValue = gameState.board?.[row]?.[col] ?? 0;
      const puzzleValue = gameState.puzzle?.[row]?.[col] ?? 0;
      const solutionValue = gameState.solution?.[row]?.[col] ?? 0;
      const isPrefilled = puzzleValue !== 0;
      const isCorrect = currentValue !== 0 && currentValue === solutionValue;
      const hasMistake = currentValue !== 0 && !isPrefilled && !isCorrect;
      
      if (hasMistake) {
        // Try to clear the cell by placing 0
        try {
          await handleCellInput(0);
          return; // Don't clear notes if we cleared a cell
        } catch (error) {
          console.error('Error clearing cell:', error);
        }
      }
    }
    
    // Default: clear all notes
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
  }, [roomId, selectedCell, gameState, handleCellInput, playerId, setGameState]);

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

    // Player 1 cannot start until player 2 has joined
    if (playerId === 'player1' && !gameState?.players?.player2) {
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

      // API response is just a nudge - fetch authoritative state from Postgres
      // Postgres is the authority, Realtime will notify us of changes
      if (result.success) {
        // Fetch authoritative state from Postgres (will be triggered by broadcasts)
        // The broadcast from the API will trigger a Postgres fetch in useVersusGame
        // No need to update state here - Postgres subscription and broadcasts handle it
      }
    } catch (error) {
      console.error('Error setting ready:', error);
    } finally {
      isReadyRequestInProgressRef.current = false;
    }
  }, [roomId, gameState, playerId]);

  // Handle name change
  const handleNameChange = useCallback(async (newName) => {
    if (!roomId || !playerId) return;

    setPlayerName(newName);
    if (onPlayerNameChange) {
      onPlayerNameChange(newName);
    }

    try {
      const response = await fetch('/api/versus/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          name: newName
        })
      });
      
      const result = await response.json();
      
      // Reload state to get updated name
      loadState();
    } catch (error) {
      console.error('Error updating name:', error);
    }
  }, [roomId, playerId, onPlayerNameChange, loadState, playerName]);

  // Handle difficulty selection and room creation
  const handleDifficultySelect = useCallback(async (selectedDifficulty) => {
    setDifficulty(selectedDifficulty);
    setHasJoinedRoomViaWS(false);
    setEnableInitialLoad(false); // Prevent loading until WebSocket connected
    // Immediately hide difficulty selection to prevent re-showing during navigation
    setShowDifficultySelection(false);
    if (onCreateRoom) {
      // Pass empty string if name is empty (server will default to 'Player 1')
      await onCreateRoom(selectedDifficulty, playerName.trim() || '');
    }
  }, [onCreateRoom, playerName]);

  // Handle cell selection
  const handleCellClick = useCallback((row, col) => {
    const currentStatus = gameState?.status || gameState?.gameStatus;
    if (currentStatus !== 'active' && currentStatus !== 'playing' || isSpectator) return;
    setSelectedCell({ row, col });
  }, [gameState, isSpectator]);

  // Handle clicking outside the board to deselect
  const handleBoardBackgroundClick = useCallback((e) => {
    // Only deselect if clicking directly on the game-board div (not on cells or other elements)
    if (selectedCell && e.target.id === 'game-board') {
      setSelectedCell(null);
    }
  }, [selectedCell]);

  // Document-level click handler to catch clicks outside the board container
  useEffect(() => {
    const handleDocumentClick = (e) => {
      // Check if click is outside game board and controls
      if (selectedCell && 
          !e.target.closest('#game-board') &&
          !e.target.closest('.versus-controls-container') &&
          !e.target.closest('.versus-panel')) {
        setSelectedCell(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [selectedCell]);

  // Keyboard input handler for desktop
  useEffect(() => {
    // Only enable keyboard input on desktop (not mobile)
    if (isMobile || isSpectator) return;

    const handleKeyDown = (e) => {
      const currentStatus = gameState?.status || gameState?.gameStatus;
      // Only handle keyboard input when game is active/playing
      if (currentStatus !== 'active' && currentStatus !== 'playing') return;

      // Don't interfere with text input fields
      const target = e.target;
      const isInputElement = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      // Check if selected cell is locked (prefilled)
      let isSelectedCellLocked = false;
      if (selectedCell && gameState) {
        const row = selectedCell.row;
        const col = selectedCell.col;
        const isPrefilled = gameState.puzzle?.[row]?.[col] !== 0;
        isSelectedCellLocked = isPrefilled;
      }

      // Toggle note mode with 'N' key
      if ((e.key === 'n' || e.key === 'N') && !isInputElement) {
        e.preventDefault();
        setNoteMode(prev => !prev);
      } else if (e.key >= '1' && e.key <= '9') {
        // Don't process number input if cell is locked or no cell selected
        if (selectedCell && !isInputElement && !isSelectedCellLocked) {
          e.preventDefault();
          handleCellInput(parseInt(e.key));
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        // Don't process clear input if cell is locked or no cell selected
        if (selectedCell && !isInputElement && !isSelectedCellLocked) {
          e.preventDefault();
          handleCellInput(0);
        }
      } else if (e.key.startsWith('Arrow')) {
        // Only handle arrow keys if a cell is already selected and not in an input field
        if (!selectedCell || isInputElement) {
          return;
        }

        e.preventDefault();

        let newRow = selectedCell.row;
        let newCol = selectedCell.col;

        switch (e.key) {
          case 'ArrowUp':
            newRow = Math.max(0, newRow - 1);
            break;
          case 'ArrowDown':
            newRow = Math.min(8, newRow + 1);
            break;
          case 'ArrowLeft':
            newCol = Math.max(0, newCol - 1);
            break;
          case 'ArrowRight':
            newCol = Math.min(8, newCol + 1);
            break;
        }

        setSelectedCell({ row: newRow, col: newCol });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, selectedCell, setSelectedCell, handleCellInput, noteMode, setNoteMode, isMobile, isSpectator]);

  // Broadcast cell selection via API
  const broadcastCellSelection = useCallback(async (row, col) => {
    if (!roomId) return;
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
  }, [roomId]);

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
      <div className="versus-create-wrapper">
        <div className="container versus-create-container">
          <header>
            <h1>Satdoku</h1>
          </header>
          <div className="versus-rules">
            <h3 className="versus-rules-title">Versus Rules</h3>
            <ol className="versus-rules-list">
              <li>Type in your name below</li>
              <li>Select a difficulty</li>
              <li>Invite a challenger by sharing a link</li>
              <li>Both players press start to play</li>
              <li>Player with more points at the end of the gamewins</li>
              <li>Cells your opponent fills are highlighted in orange</li>
              <li>Buy a life with bitcoin if you run out</li>
            </ol>
          </div>
          <h2 className="versus-create-heading"></h2>
          <div className="difficulty-selection">
            <label className="versus-form-label">Your Name:</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              className="name-input versus-name-input"
              placeholder="Player 1"
              autoFocus
            />
            <label className="versus-form-label">Select Difficulty:</label>
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
  const currentStatus = gameState?.status || gameState?.gameStatus;
  // Board is visible when game is active/playing/finished AND countdown has finished
  const boardVisible = gameState && ((currentStatus === 'active' || currentStatus === 'playing') || currentStatus === 'finished') && countdownFinished;
  // Show countdown when we have start_at, countdown hasn't finished, and status is active
  const showCountdown = gameState?.start_at && !countdownFinished && currentStatus === 'active';

  return (
    <div className={`versus-page ${isMobile ? 'mobile' : 'desktop'}`}>
      <VersusReconnecting isReconnecting={isReconnecting} />
      <VersusNotification 
        notification={notification} 
        onClose={() => setNotification(null)}
      />
      <VersusWinModal
        show={showWinModal}
        winStats={winStats}
        onClose={() => {
          setShowWinModal(false);
          setHasDismissedWinModal(true);
        }}
      />
      <VersusPurchaseLifeModal
        isOpen={showPurchaseLifeModal}
        onClose={() => setShowPurchaseLifeModal(false)}
        onSuccess={() => {
          setShowPurchaseLifeModal(false);
          // Reload state to get updated lives
          loadState();
        }}
        roomId={roomId}
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
                gameStatus={gameState?.status || gameState?.gameStatus}
                onNameChange={handleNameChange}
                onReadyClick={handleReadyClick}
                roomUrl={roomId ? `/versus?room=${roomId}` : null}
                showCopyUrl={isPlayer1}
                player2Connected={isPlayer1 ? !!player2Data : (isPlayer2 ? true : undefined)}
                isPlayer1Panel={true}
              />
            </div>
            <div className="versus-board-container" onClick={handleBoardBackgroundClick}>
              {showCountdown && (
                <VersusCountdown 
                  countdown={calculatedCountdown} 
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
                      opponentFilledCells={isSpectator ? null : opponentFilledCells}
                      clearedMistakes={isSpectator ? null : (gameState.clearedMistakes || [])}
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
                        disabled={!selectedCell || (gameState.status !== 'active' && gameState.gameStatus !== 'playing')}
                        versus={true}
                      />
                      <NoteControls
                        noteMode={noteMode}
                        onToggleNoteMode={() => setNoteMode(!noteMode)}
                        onClear={handleErase}
                        disabled={gameState.status !== 'active' && gameState.gameStatus !== 'playing'}
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
                  ready: false
                }}
                isYou={isPlayer2}
                gameStatus={gameState?.status || gameState?.gameStatus}
                onNameChange={handleNameChange}
                onReadyClick={handleReadyClick}
                isWaiting={!player2Data}
                roomUrl={roomId ? `/versus?room=${roomId}` : null}
                showCopyUrl={isPlayer2 && roomId && (gameState?.status === 'active' || gameState?.status === 'finished')}
                isPlayer2Panel={true}
              />
            </div>
          </>
        ) : (
          <>
            <div className="versus-panel mobile-top">
              <VersusPlayerPanel
                player={isPlayer1 && !opponentData ? {
                  name: 'Player 2',
                  score: 0,
                  lives: 2,
                  ready: false
                } : opponentData}
                isYou={false}
                gameStatus={gameState?.gameStatus}
                compact={true}
                isPlayer2Panel={isPlayer1}
                isPlayer1Panel={isPlayer2}
                isWaiting={isPlayer1 ? !player2Data : undefined}
                player2Connected={isPlayer2 ? true : (isPlayer1 ? !!player2Data : undefined)}
              />
            </div>
            <div className="versus-board-container mobile">
              {showCountdown && (
                <VersusCountdown 
                  countdown={calculatedCountdown} 
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
                      opponentFilledCells={isSpectator ? null : opponentFilledCells}
                      clearedMistakes={isSpectator ? null : (gameState.clearedMistakes || [])}
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
                        disabled={!selectedCell || (gameState.status !== 'active' && gameState.gameStatus !== 'playing')}
                        versus={true}
                      />
                      <NoteControls
                        noteMode={noteMode}
                        onToggleNoteMode={() => setNoteMode(!noteMode)}
                        onClear={handleErase}
                        disabled={gameState.status !== 'active' && gameState.gameStatus !== 'playing'}
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
                player2Connected={isPlayer1 ? !!player2Data : undefined}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
