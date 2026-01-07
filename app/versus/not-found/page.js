'use client';

import { useRouter } from 'next/navigation';

export default function VersusNotFoundPage() {
  const router = useRouter();

  const handleCreateGame = () => {
    router.push('/versus');
  };

  return (
    <div className="versus-not-found-page">
      <div className="not-found-content">
        <h1>Room Not Found</h1>
        <p>The room you're looking for doesn't exist or has expired.</p>
        <button onClick={handleCreateGame} className="create-game-button">
          Create Your Own Versus Game
        </button>
      </div>
    </div>
  );
}

