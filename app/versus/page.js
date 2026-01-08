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

  // Get sessionId - needed for both creating and joining rooms
  useEffect(() => {
    if (!sessionId) {
      // Call API to get/create sessionId
      fetch('/api/versus/init', { method: 'GET' })
        .then(res => res.json())
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
          setLoading(false);
        });
    }
  }, [roomId, sessionId]);

  // Initialize room
  useEffect(() => {
    async function initRoom() {
      if (!sessionId) {
        return;
      }

      try {
        setLoading(true);
        
        if (roomId) {
          // Join existing room
          const response = await fetch(`/api/versus/init?room=${roomId}`);
          const data = await response.json();
          
          if (!data.success) {
            if (data.error === 'Room not found') {
              router.push('/versus/not-found');
              return;
            }
            setError(data.error);
            return;
          }

          setPlayerId(data.playerId);
          setIsSpectator(data.isSpectator || false);
          setDifficulty(data.room?.difficulty);
          if (data.sessionId) {
            setSessionId(data.sessionId);
          }
          if (data.playerId === 'player2') {
            setPlayerName('Player 2');
          }
        } else {
          // Show difficulty selection - will be handled by component
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error initializing room:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (sessionId) {
      initRoom();
    }
  }, [roomId, sessionId, router]);

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

      const data = await response.json();
      
      if (data.success) {
        setDifficulty(selectedDifficulty);
        setPlayerName(name || 'Player 1');
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
        
        router.push(`/versus?room=${data.roomId}`);
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

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
        onCreateRoom={handleCreateRoom}
        initialPlayerName={playerName}
        onPlayerNameChange={setPlayerName}
      />
    );
  }

  if (loading) {
    return <div>Loading room...</div>;
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

