'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import VersusPage from '../../components/VersusPage.jsx';

function VersusPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = searchParams.get('room');
  const [sessionId, setSessionId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [playerName, setPlayerName] = useState('Player 1');
  const [isNavigating, setIsNavigating] = useState(false);
  const prevRoomIdRef = useRef(null);

  // Get sessionId - needed for both creating and joining rooms
  useEffect(() => {
    if (!sessionId) {
      // Call API to get/create sessionId
      fetch('/api/versus/init', { method: 'GET' })
        .then(async res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.sessionId) {
            setSessionId(data.sessionId);
          }
          // Only set loading to false if we're not joining a room (roomId will trigger initRoom)
          if (!roomId) {
            setLoading(false);
          }
        })
        .catch(err => {
          console.error('Error getting sessionId:', err);
          setError(err.message);
          setLoading(false);
        });
    } else if (!roomId) {
      // If we have sessionId but no roomId, show difficulty selection
      setLoading(false);
    }
  }, [roomId, sessionId]);

  // Initialize room
  useEffect(() => {
    async function initRoom() {
      if (!sessionId) {
        return;
      }

      try {
        // If we already have a valid playerId (player1 or player2), skip API call
        // This prevents overwriting valid playerId with null from spectator responses
        const alreadyHavePlayerId = playerId === 'player1' || playerId === 'player2';
        if (!alreadyHavePlayerId) {
          setLoading(true);
        }
        
        if (roomId) {
          // Only call API if we don't already have a valid playerId
          if (!alreadyHavePlayerId) {
            // Join existing room
            const response = await fetch(`/api/versus/init?room=${roomId}`);
            
            // Check if response is ok before parsing
            if (!response.ok) {
              if (response.status === 404) {
                router.push('/versus/not-found');
                return;
              }
              setError(`HTTP error! status: ${response.status}`);
              setLoading(false);
              return;
            }
            
            const data = await response.json();
            
            if (!data.success) {
              if (data.error === 'Room not found') {
                router.push('/versus/not-found');
                return;
              }
              setError(data.error);
              setLoading(false);
              return;
            }

            // Only update playerId if we don't already have a valid one, or if API returns a valid one
            // This prevents overwriting 'player1' or 'player2' with null from spectator responses
            if (data.playerId && (playerId === null || playerId === undefined)) {
              setPlayerId(data.playerId);
            } else if (data.playerId) {
              // API returned a valid playerId, use it even if we had one before (might be correcting)
              setPlayerId(data.playerId);
            }
            // Don't overwrite playerId with null if we already have a valid value
            // Only set isSpectator if we have a valid playerId OR if API returns a valid playerId
            // This prevents overwriting isSpectator=false with isSpectator=true from spectator responses
            const hasValidPlayerId = playerId === 'player1' || playerId === 'player2';
            const apiReturnsValidPlayerId = data.playerId === 'player1' || data.playerId === 'player2';
            if (hasValidPlayerId || apiReturnsValidPlayerId) {
              // Only update isSpectator if we have or are getting a valid playerId
              setIsSpectator(data.isSpectator || false);
            }
            // If we already have a valid playerId and API returns null/spectator, don't overwrite isSpectator
            setDifficulty(data.room?.difficulty);
            if (data.sessionId) {
              setSessionId(data.sessionId);
            }
            if (data.playerId === 'player2') {
              setPlayerName('Player 2');
            }
          }
          setLoading(false);
        } else {
          // Show difficulty selection - will be handled by component
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error initializing room:', err);
        setError(err.message);
        setLoading(false);
      }
    }

    if (sessionId) {
      initRoom();
    }
    // Only depend on roomId and sessionId - don't re-run when playerId changes
    // This prevents overwriting valid playerId when effect re-runs
  }, [roomId, sessionId, router]);

  // Reset isNavigating when user navigates back (roomId goes from truthy to null)
  useEffect(() => {
    const prevRoomId = prevRoomIdRef.current;
    prevRoomIdRef.current = roomId;
    
    if (roomId) {
      // When we successfully navigate to a room, reset the flag
      setIsNavigating(false);
    } else if (prevRoomId && !roomId && isNavigating) {
      // User navigated back (roomId went from truthy to null), reset the flag
      setIsNavigating(false);
    }
  }, [roomId, isNavigating]);

  // Handle creating new room
  const handleCreateRoom = useCallback(async (selectedDifficulty, name) => {
    try {
      setLoading(true);
      const response = await fetch('/api/versus/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: selectedDifficulty,
          playerName: name || 'Player 1'
        })
      });

      if (!response.ok) {
        setError(`HTTP error! status: ${response.status}`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        setDifficulty(selectedDifficulty);
        setPlayerName(name || 'Player 1');
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
        // Set playerId and navigating flag before navigation
        setPlayerId('player1');
        setIsNavigating(true); // Mark that we're navigating to prevent re-rendering create screen
        
        // Navigate immediately - loading screen will show during transition
        router.push(`/versus?room=${data.roomId}`);
      } else {
        setError(data.error);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [router]);

  // If navigating to room after creation, show loading instead of create screen
  if (isNavigating && !roomId) {
    return <div>Loading...</div>;
  }

  if (loading && !roomId) {
    return <div>Loading...</div>;
  }

  if (error && !roomId) {
    return <div>Error: {error}</div>;
  }

  if (!roomId) {
    // Show difficulty selection
    return (
      <VersusPage
        mode="create"
        roomId={null}
        sessionId={sessionId}
        playerId={null}
        onCreateRoom={handleCreateRoom}
        initialPlayerName={playerName}
        onPlayerNameChange={setPlayerName}
      />
    );
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <VersusPage
      mode="play"
      roomId={roomId}
      sessionId={sessionId}
      playerId={playerId}
      isSpectator={isSpectator}
      initialPlayerName={playerName}
      onPlayerNameChange={setPlayerName}
    />
  );
}

export default function VersusPageRoute() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VersusPageContent />
    </Suspense>
  );
}
