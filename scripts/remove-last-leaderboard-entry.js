import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { removeLastLeaderboardEntry } from '../lib/redis/leaderboard.js';

// Load environment variables from .env.local if it exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  // .env.local doesn't exist or can't be read, that's okay
  console.warn('Note: Could not load .env.local file. Make sure REDIS_URL is set in environment.');
}

async function main() {
  try {
    console.log('Removing last leaderboard entry...');
    const result = await removeLastLeaderboardEntry();

    if (result.removed) {
      console.log('Successfully removed last entry:');
      console.log(JSON.stringify(result.entry, null, 2));
    } else {
      console.log('No entries found in leaderboard to remove.');
    }

    // Close Redis connection by exiting
    process.exit(0);
  } catch (error) {
    console.error('Error removing last leaderboard entry:', error);
    process.exit(1);
  }
}

main();












