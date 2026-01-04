/**
 * Script to clear and regenerate puzzle cache
 * Run with: node scripts/clear-puzzle-cache.js
 */

import 'dotenv/config';
import { clearPuzzleCache, getAllCacheCounts } from '../lib/redis/puzzleCache.js';
import { initializePuzzleCache } from '../lib/redis/puzzleGenerator.js';

async function main() {
  console.log('=== Puzzle Cache Management ===\n');
  
  // 1. Check current cache status
  console.log('1. Checking current cache status...');
  const beforeCounts = await getAllCacheCounts();
  console.log('   Current counts:', beforeCounts);
  console.log('');
  
  // 2. Clear the cache
  console.log('2. Clearing puzzle cache...');
  const clearResult = await clearPuzzleCache();
  if (clearResult.success) {
    console.log(`   ✓ Successfully cleared cache for: ${clearResult.cleared.join(', ')}`);
  } else {
    console.log('   ✗ Failed to clear cache');
    process.exit(1);
  }
  console.log('');
  
  // 3. Verify cache is empty
  console.log('3. Verifying cache is empty...');
  const afterClear = await getAllCacheCounts();
  console.log('   Cache counts:', afterClear);
  console.log('');
  
  // 4. Regenerate cache with new validated puzzles
  console.log('4. Regenerating cache with validated puzzles...');
  console.log('   This may take a minute...');
  await initializePuzzleCache();
  console.log('');
  
  // 5. Verify new cache is populated
  console.log('5. Verifying new cache is populated...');
  const finalCounts = await getAllCacheCounts();
  console.log('   Final counts:', finalCounts);
  console.log('');
  
  console.log('=== Cache Refresh Complete! ===');
  console.log('All puzzles are now validated to have unique solutions.');
  
  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
