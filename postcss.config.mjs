// #region agent log
import { writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  writeFileSync('/Users/andrewyang/code/satdoku/.cursor/debug.log', JSON.stringify({
    sessionId: 'debug-session',
    runId: 'post-fix',
    hypothesisId: 'F',
    location: 'postcss.config.mjs:1',
    message: 'Using function plugins - PostCSS resolves before config loads',
    data: { approach: 'function plugins', reason: 'webpack context resolution issue' },
    timestamp: Date.now()
  }) + '\n', { flag: 'a' });
} catch (e) {}
// #endregion

// #region agent log
let tailwindcssPlugin = null;
try {
  tailwindcssPlugin = require('@tailwindcss/postcss');
  writeFileSync('/Users/andrewyang/code/satdoku/.cursor/debug.log', JSON.stringify({
    sessionId: 'debug-session',
    runId: 'post-fix',
    hypothesisId: 'F',
    location: 'postcss.config.mjs:2',
    message: 'Tailwind plugin loaded',
    data: { type: typeof tailwindcssPlugin, isFunction: typeof tailwindcssPlugin === 'function' },
    timestamp: Date.now()
  }) + '\n', { flag: 'a' });
} catch (e) {
  writeFileSync('/Users/andrewyang/code/satdoku/.cursor/debug.log', JSON.stringify({
    sessionId: 'debug-session',
    runId: 'post-fix',
    hypothesisId: 'F',
    location: 'postcss.config.mjs:2',
    message: 'Tailwind plugin load failed',
    data: { error: e.message },
    timestamp: Date.now()
  }) + '\n', { flag: 'a' });
  throw e;
}
// #endregion

// #region agent log
let autoprefixerPlugin = null;
try {
  autoprefixerPlugin = require('autoprefixer');
  writeFileSync('/Users/andrewyang/code/satdoku/.cursor/debug.log', JSON.stringify({
    sessionId: 'debug-session',
    runId: 'post-fix',
    hypothesisId: 'F',
    location: 'postcss.config.mjs:3',
    message: 'Autoprefixer plugin loaded',
    data: { type: typeof autoprefixerPlugin },
    timestamp: Date.now()
  }) + '\n', { flag: 'a' });
} catch (e) {
  writeFileSync('/Users/andrewyang/code/satdoku/.cursor/debug.log', JSON.stringify({
    sessionId: 'debug-session',
    runId: 'post-fix',
    hypothesisId: 'F',
    location: 'postcss.config.mjs:3',
    message: 'Autoprefixer plugin load failed',
    data: { error: e.message },
    timestamp: Date.now()
  }) + '\n', { flag: 'a' });
  throw e;
}
// #endregion

// Use function plugins directly - this bypasses PostCSS string resolution
// which happens in webpack context where module resolution may fail
export default {
  plugins: [
    tailwindcssPlugin,
    autoprefixerPlugin,
  ],
}
