#!/usr/bin/env node
/**
 * Query Redis for answer leak detector trigger counts
 * 
 * Usage:
 *   node scripts/query-answer-leak-triggers.js
 *   node scripts/query-answer-leak-triggers.js --date 2024-01-15
 *   node scripts/query-answer-leak-triggers.js --total
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getRedisClient } from '../lib/redis/client.js';

// Load environment variables from .env.local or .env if they exist
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try .env.local first (Next.js convention), then .env
const envPaths = [
  join(__dirname, '..', '.env.local'),
  join(__dirname, '..', '.env')
];

for (const envPath of envPaths) {
  try {
    const envFile = readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=:#]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
          // Remove quotes if present
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          process.env[match[1]] = value;
        }
      }
    });
    break; // Stop after successfully loading first file
  } catch (error) {
    // File doesn't exist or can't be read, try next one
    continue;
  }
}

async function queryAnswerLeakTriggers() {
  const args = process.argv.slice(2);
  const dateArg = args.find(arg => arg.startsWith('--date='))?.split('=')[1];
  const showTotal = args.includes('--total');
  const showDate = dateArg || args.includes('--date');

  const client = await getRedisClient();
  
  if (!client) {
    console.error('❌ Redis client not available. Check REDIS_URL environment variable.');
    console.error('   Make sure REDIS_URL is set in .env.local or .env file.');
    process.exit(1);
  }

  try {
    // Get all trigger keys
    const keys = await client.keys('answer_leak:trigger:*');
    
    if (keys.length === 0) {
      console.log('📊 No answer leak trigger data found in Redis.');
      return;
    }

    // Sort keys by date (newest first)
    keys.sort().reverse();

    let totalCount = 0;
    const results = [];

    // Get values for all keys
    for (const key of keys) {
      const count = await client.get(key);
      const date = key.replace('answer_leak:trigger:', '');
      const countNum = parseInt(count, 10) || 0;
      totalCount += countNum;
      results.push({ date, count: countNum, key });
    }

    // Display results
    if (dateArg) {
      // Show specific date
      const result = results.find(r => r.date === dateArg);
      if (result) {
        console.log(`📅 Answer leak triggers for ${dateArg}: ${result.count}`);
      } else {
        console.log(`📅 No data found for date: ${dateArg}`);
      }
    } else if (showTotal) {
      // Show only total
      console.log(`📊 Total answer leak triggers (all time): ${totalCount}`);
    } else {
      // Show all dates with counts
      console.log('\n📊 Answer Leak Detector Trigger Counts:\n');
      console.log('Date       | Count');
      console.log('-----------|------');
      results.forEach(({ date, count }) => {
        console.log(`${date} | ${count.toString().padStart(5)}`);
      });
      console.log('-----------|------');
      console.log(`Total      | ${totalCount.toString().padStart(5)}\n`);
    }

    // Also show detected leaks if available
    const detectedKeys = await client.keys('answer_leak:detected:*');
    if (detectedKeys.length > 0) {
      let totalDetected = 0;
      const detectedResults = [];
      
      // Sort detected keys by date (newest first)
      detectedKeys.sort().reverse();
      
      for (const key of detectedKeys) {
        const count = await client.get(key);
        const date = key.replace('answer_leak:detected:', '');
        const countNum = parseInt(count, 10) || 0;
        totalDetected += countNum;
        if (countNum > 0) {
          detectedResults.push({ date, count: countNum });
        }
      }
      
      if (detectedResults.length > 0) {
        console.log('\n⚠️  Leaks Detected by Date:\n');
        console.log('Date       | Count');
        console.log('-----------|------');
        detectedResults.forEach(({ date, count }) => {
          console.log(`${date} | ${count.toString().padStart(5)}`);
        });
        console.log('-----------|------');
        console.log(`Total      | ${totalDetected.toString().padStart(5)}\n`);
      } else {
        console.log(`⚠️  Total leaks detected: ${totalDetected}`);
      }
    }

  } catch (error) {
    console.error('❌ Error querying Redis:', error);
    process.exit(1);
  } finally {
    await client.quit();
  }
}

queryAnswerLeakTriggers();

