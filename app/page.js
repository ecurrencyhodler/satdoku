'use client';

import { Suspense } from 'react';
import GamePage from '../components/GamePage';

export default function HomePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GamePage />
    </Suspense>
  );
}
