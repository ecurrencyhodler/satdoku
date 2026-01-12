'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVersusWebSocket } from './hooks/useVersusWebSocket.js';
import { useVersusGame } from './hooks/useVersusGame.js';
import { useVersusPresence } from './hooks/useVersusPresence.js';
import { useVersusCellInput } from './hooks/useVersusCellInput.js';
import { useMobileDetection } from './hooks/useMobileDetection.js';
import { useVersusCountdown } from './hooks/useVersusCountdown.js';
import { useVersusKeyboard } from './hooks/useVersusKeyboard.js';
import { useOpponentCellTracking } from './hooks/useOpponentCellTracking.js';
import { useVersusPlayerActions } from './hooks/useVersusPlayerActions.js';
import { transformVersusStateToClient } from '../lib/game/versusGameStateClient.js';
import VersusPlayerPanel from './VersusPlayerPanel.jsx';
import VersusCountdown from './VersusCountdown.jsx';
import VersusInviteUrl from './VersusInviteUrl.jsx';
import VersusNotification from './VersusNotification.jsx';
import VersusReconnecting from './VersusReconnecting.jsx';
import VersusWinModal from './Modals/VersusWinModal.jsx';
import VersusPurchaseLifeModal from './Modals/VersusPurchaseLifeModal.jsx';
import VersusGameBoard from './VersusGameBoard.jsx';
import VersusDifficultySelection from './VersusDifficultySelection.jsx';

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
  const triggerPresenceUpdateRef = useRef(null);
  
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
    
    // Handle presence events forwarded from useVersusWebSocket
    // These events fire in useVersusWebSocket (registered before subscribe)
    // but the listeners in useVersusPresence don't fire (registered after subscribe)
    // So we trigger update here when presence messages are received
    if (message.type === 'presence_sync' || message.type === 'presence_join' || message.type === 'presence_leave') {
      if (triggerPresenceUpdateRef.current) {
        triggerPresenceUpdateRef.current();
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
  const { isConnected, isReconnecting, sendMessage, channel } = useVersusWebSocket(
    roomId,
    sessionId,
    playerId,
    handleWebSocketMessage,
    handleReconnect
  );

  // Presence = UX only (prescription: "Use presence for UX only")
  // Postgres decides game state (prescription: "Let Postgres decide game state")
  const { player1Connected: presencePlayer1Connected, player2Connected: presencePlayer2Connected, opponentSelectedCell: presenceOpponentSelectedCell, triggerUpdate: triggerPresenceUpdate } = useVersusPresence(channel, playerId);
  
  // Store triggerPresenceUpdate in ref so it's available in handleWebSocketMessage callback
  useEffect(() => {
    triggerPresenceUpdateRef.current = triggerPresenceUpdate;
  }, [triggerPresenceUpdate]);




  // Track if we've ever seen player1 connected for this room (using presence)
  useEffect(() => {
    if (roomId && presencePlayer1Connected && !hasSeenPlayer1ConnectedRef.current) {
      hasSeenPlayer1ConnectedRef.current = true;
      // Force a single re-render to show the game
      setShowDifficultySelection(false);
    }
  }, [roomId, presencePlayer1Connected]);

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

  // Calculate countdown from start_at timestamp using the hook
  // MUST be called before any conditional returns to follow Rules of Hooks
  const { countdown: calculatedCountdown, isActive: countdownFinished } = useVersusCountdown(gameState?.start_at);

  // Track opponent-filled cells
  const { opponentFilledCells, trackMoveAttempt } = useOpponentCellTracking(gameState, isSpectator);

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

  // Wrapper for handleCellInput to track player moves
  const handleCellInput = useCallback(async (value) => {
    if (!selectedCell) return;
    
    // Track the move attempt
    trackMoveAttempt(selectedCell.row, selectedCell.col, value);
    
    // Call the original handler
    await originalHandleCellInput(value);
  }, [selectedCell, originalHandleCellInput, trackMoveAttempt]);

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

  // Player actions (ready, name change)
  const { handleReadyClick, handleNameChange: handleNameChangeFromHook } = useVersusPlayerActions(
    roomId,
    playerId,
    gameState,
    loadState,
    (newName) => {
      setPlayerName(newName);
      if (onPlayerNameChange) {
        onPlayerNameChange(newName);
      }
    }
  );

  // Wrapper for name change to update local state
  const handleNameChange = useCallback(async (newName) => {
    await handleNameChangeFromHook(newName);
  }, [handleNameChangeFromHook]);

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
  useVersusKeyboard({
    gameState,
    selectedCell,
    setSelectedCell,
    handleCellInput,
    noteMode,
    setNoteMode,
    isMobile,
    isSpectator
  });

  // Note: Cell selection is now tracked via presence, not via API calls

  // Update presence with selected cell when it changes (ephemeral UI state)
  useEffect(() => {
    if (channel && selectedCell && !isSpectator) {
      const currentStatus = gameState?.status || gameState?.gameStatus;
      if (currentStatus === 'active' || currentStatus === 'playing') {
        // Update presence with selected cell - this is ephemeral UI state
        channel.track({
          playerId: playerId,
          sessionId: sessionId,
          selectedCell: { row: selectedCell.row, col: selectedCell.col }
        });
      }
    } else if (channel && !selectedCell && !isSpectator) {
      // Clear selected cell from presence when deselected
      channel.track({
        playerId: playerId,
        sessionId: sessionId,
        selectedCell: null
      });
    }
  }, [channel, selectedCell, roomId, isSpectator, gameState, playerId, sessionId]);

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
      <VersusDifficultySelection
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        onDifficultySelect={handleDifficultySelect}
      />
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
                player2Connected={isPlayer1 ? presencePlayer2Connected : (isPlayer2 ? true : undefined)}
                isPlayer1Panel={true}
              />
            </div>
            <div className="versus-board-container" onClick={handleBoardBackgroundClick}>
              <VersusGameBoard
                gameState={gameState}
                selectedCell={selectedCell}
                opponentSelectedCell={presenceOpponentSelectedCell}
                onCellClick={handleCellClick}
                handleCellInput={handleCellInput}
                handleErase={handleErase}
                noteMode={noteMode}
                setNoteMode={setNoteMode}
                yourData={yourData}
                opponentFilledCells={opponentFilledCells}
                isSpectator={isSpectator}
                boardVisible={boardVisible}
                showCountdown={showCountdown}
                calculatedCountdown={calculatedCountdown}
                VersusCountdown={VersusCountdown}
              />
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
                player2Connected={isPlayer2 ? true : (isPlayer1 ? presencePlayer2Connected : undefined)}
              />
            </div>
            <div className="versus-board-container mobile">
              <VersusGameBoard
                gameState={gameState}
                selectedCell={selectedCell}
                opponentSelectedCell={presenceOpponentSelectedCell}
                onCellClick={handleCellClick}
                handleCellInput={handleCellInput}
                handleErase={handleErase}
                noteMode={noteMode}
                setNoteMode={setNoteMode}
                yourData={yourData}
                opponentFilledCells={opponentFilledCells}
                isSpectator={isSpectator}
                boardVisible={boardVisible}
                showCountdown={showCountdown}
                calculatedCountdown={calculatedCountdown}
                VersusCountdown={VersusCountdown}
              />
            </div>
            <div className="versus-panel mobile-bottom">
              <VersusPlayerPanel
                player={yourData}
                isYou={true}
                gameStatus={gameState?.gameStatus}
                onNameChange={handleNameChange}
                onReadyClick={handleReadyClick}
                compact={true}
                player2Connected={isPlayer1 ? presencePlayer2Connected : undefined}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
