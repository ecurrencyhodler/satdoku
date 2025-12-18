#!/usr/bin/env node

/**
 * Script to clear the leaderboard, preserving only ecurrencyhodler
 * Usage: node scripts/reset-leaderboard.js
 *
 * Make sure REDIS_URL is set in your environment or .env.local file
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { clearLeaderboard } from '../lib/redis/leaderboard.js';
import { getRedisClient } from '../lib/redis/client.js';

// Load .env.local if it exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

try {
  const envFile = readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  });
} catch (error) {
  // .env.local doesn't exist or can't be read, that's okay
  // User can set environment variables directly
}

async function resetLeaderboard() {
  let client;
  try {
    // Get Redis client to ensure connection
    client = await getRedisClient();
    if (!client) {
      throw new Error('Redis client not available. Make sure REDIS_URL is set in .env.local');
    }

    console.log('Clearing leaderboard (preserving ecurrencyhodler)...');
    await clearLeaderboard();
    console.log('✓ Leaderboard cleared. Only ecurrencyhodler entry remains.');

    console.log('\nLeaderboard reset complete!');
  } catch (error) {
    console.error('Error resetting leaderboard:', error);
    process.exit(1);
  } finally {
    // Disconnect from Redis
    if (client && client.isOpen) {
      await client.quit();
      console.log('Redis connection closed');
    }
  }
}

resetLeaderboard();







