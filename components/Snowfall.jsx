'use client';

import { useState, useRef, useEffect } from 'react';
import './Snowfall.css';

const SNOWFLAKE_COUNT = 30;

export default function Snowfall() {
  const [isVisible, setIsVisible] = useState(true);
  const [snowflakeData, setSnowflakeData] = useState([]);
  const completedCountRef = useRef(0);

  // Generate snowflake data only on client side to avoid hydration mismatch
  useEffect(() => {
    setSnowflakeData(
      Array.from({ length: SNOWFLAKE_COUNT }, (_, i) => ({
        id: i,
        left: `${(i * (100 / SNOWFLAKE_COUNT)) + Math.random() * (100 / SNOWFLAKE_COUNT)}%`,
        delay: Math.random() * 2,
        duration: 3 + Math.random() * 4,
        opacity: 0.7 + Math.random() * 0.3,
      }))
    );
  }, []);

  const handleAnimationEnd = () => {
    completedCountRef.current += 1;
    if (completedCountRef.current >= SNOWFLAKE_COUNT) {
      setIsVisible(false);
    }
  };

  if (!isVisible || snowflakeData.length === 0) return null;

  return (
    <div className="snowfall-container">
      {snowflakeData.map((snowflake) => (
        <div
          key={snowflake.id}
          className="snowflake"
          style={{
            left: snowflake.left,
            animationDelay: `${snowflake.delay}s`,
            animationDuration: `${snowflake.duration}s`,
            opacity: snowflake.opacity,
          }}
          onAnimationEnd={handleAnimationEnd}
        >
          ❄
        </div>
      ))}
    </div>
  );
}

