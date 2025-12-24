/**
 * Answer Leak Detector
 * Non-AI check that scans coach response for answer leaks
 */

import { logTrigger, logLeakDetected } from '../supabase/answerLeakDetector.js';

/**
 * Check if a coach response contains leaked answer information
 * @param {string} response - The coach's response text
 * @param {number[][]} solution - The complete solution board (9x9 array)
 * @param {{row: number, col: number}|undefined} highlightedCell - Optional highlighted cell coordinates
 * @returns {boolean} - true if answer appears to be leaked
 */
export function checkForAnswerLeak(response, solution, highlightedCell) {
  // Log that function was triggered (fire-and-forget)
  logTrigger().catch(() => {});

  // Edge case: If solution is not available, cannot detect leaks
  if (!solution || !Array.isArray(solution) || solution.length !== 9) {
    console.warn('[answerLeakDetector] Solution not available or invalid, skipping leak detection');
    return false;
  }

  // Validate solution structure
  const isValidSolution = solution.every(row =>
    Array.isArray(row) && row.length === 9
  );
  if (!isValidSolution) {
    console.warn('[answerLeakDetector] Solution structure invalid, skipping leak detection');
    return false;
  }

  // Extract all digits mentioned in the response
  const digitPattern = /\b([1-9])\b/g;
  const mentionedDigits = [];
  let match;
  while ((match = digitPattern.exec(response)) !== null) {
    mentionedDigits.push(parseInt(match[1], 10));
  }

  // If highlighted cell is provided, check for context-specific leaks
  if (highlightedCell) {
    const { row, col } = highlightedCell;

    // Validate coordinates
    if (typeof row !== 'number' || typeof col !== 'number' ||
        row < 0 || row >= 9 || col < 0 || col >= 9) {
      // Invalid coordinates, skip context-specific check
      console.warn('[answerLeakDetector] Invalid highlighted cell coordinates, skipping context check');
    } else {
      const solutionValue = solution[row][col];

      // Only check if the solution cell has a value (not 0)
      if (solutionValue !== 0 && solutionValue !== null && solutionValue !== undefined) {
        // Check if any mentioned digit matches the solution
        if (mentionedDigits.includes(solutionValue)) {
          // Check for confirmation phrases that would indicate a leak
          const confirmationPatterns = [
            /\b(the answer is|it's|it is|that's|that is|you should place|put a|place a|enter|fill in|fill with)\s+([1-9])\b/gi,
            /\b([1-9])\s+(is|goes|belongs|should be|must be|needs to be)\s+(here|in this cell|in this|there)\b/gi,
            /\bdefinitely\s+([1-9])\b/gi,
            /\bcertainly\s+([1-9])\b/gi,
            /\bcorrect\s+(answer|number|digit|value)\s+(is|would be)\s+([1-9])\b/gi
          ];

          for (const pattern of confirmationPatterns) {
            if (pattern.test(response)) {
              console.warn(`[answerLeakDetector] Leak detected: Confirmation phrase with digit ${solutionValue}`);
              logLeakDetected().catch(() => {}); // Log leak detection
              return true;
            }
          }

          // If the digit is mentioned and it matches the solution, check context
          // This is a conservative check - if digit is mentioned near confirmation words, it's likely a leak
          const contextPattern = new RegExp(
            `(answer|solution|correct|right|should|must|place|put|enter|fill).{0,20}\\b${solutionValue}\\b|\\b${solutionValue}\\b.{0,20}(answer|solution|correct|right|should|must|place|put|enter|fill)`,
            'gi'
          );

          if (contextPattern.test(response)) {
            console.warn(`[answerLeakDetector] Leak detected: Digit ${solutionValue} mentioned in suspicious context`);
            logLeakDetected().catch(() => {}); // Log leak detection
            return true;
          }
        }
      }
    }
  }

  // Check for general leak patterns (confirmation phrases without specific digits)
  const generalLeakPatterns = [
    /\bthe answer is\s+([1-9])\b/gi,
    /\bit's\s+definitely\s+([1-9])\b/gi,
    /\byou should place\s+([1-9])\b/gi,
    /\bput a\s+([1-9])\b/gi,
    /\bplace a\s+([1-9])\b/gi,
    /\benter\s+([1-9])\b/gi,
    /\bfill in\s+([1-9])\b/gi,
    /\bfill with\s+([1-9])\b/gi,
    /\bthat's\s+([1-9])\b/gi,
    /\bthat is\s+([1-9])\b/gi
  ];

  for (const pattern of generalLeakPatterns) {
    if (pattern.test(response)) {
      console.warn('[answerLeakDetector] Leak detected: General confirmation phrase found');
      logLeakDetected().catch(() => {}); // Log leak detection
      return true;
    }
  }

  // No leak detected
  return false;
}

















