import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSessionId } from '../../../../lib/session/cookieSession.js';
import { getGameState } from '../../../../lib/redis/gameState.js';
import { checkForAnswerLeak } from '../../../../lib/tutor/answerLeakDetector.js';
import { getCoachHowiePrompt, getStrategyDescription, formatBoardForPrompt } from '../../../../lib/tutor/strategyPrompts.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_RETRIES = 2;

/**
 * POST /api/tutor/coach
 * Howie teaches the selected strategy without revealing answers
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { board, puzzle, highlightedCell, strategy, chatHistory, message } = body;

    // Validation: Check if board is provided
    if (!board) {
      return NextResponse.json(
        { error: 'NO_BOARD', message: 'No game board available. Please start a new game.' },
        { status: 400 }
      );
    }

    // Validation: Check if puzzle is provided
    if (!puzzle) {
      return NextResponse.json(
        { error: 'NO_BOARD', message: 'No game board available. Please start a new game.' },
        { status: 400 }
      );
    }

    // Validation: Check board structure
    if (!Array.isArray(board) || board.length !== 9 ||
        !board.every(row => Array.isArray(row) && row.length === 9)) {
      return NextResponse.json(
        { error: 'INVALID_BOARD', message: 'Board structure invalid' },
        { status: 400 }
      );
    }

    // Validation: Check puzzle structure
    if (!Array.isArray(puzzle) || puzzle.length !== 9 ||
        !puzzle.every(row => Array.isArray(row) && row.length === 9)) {
      return NextResponse.json(
        { error: 'INVALID_BOARD', message: 'Puzzle structure invalid' },
        { status: 400 }
      );
    }

    // Validation: Check strategy is provided
    if (!strategy || typeof strategy !== 'string') {
      return NextResponse.json(
        { error: 'INVALID_STRATEGY', message: 'Invalid strategy provided' },
        { status: 400 }
      );
    }

    // Get solution from game state (for leak detection)
    let solution = null;
    try {
      const sessionId = await getSessionId();
      if (sessionId) {
        const gameState = await getGameState(sessionId);
        if (gameState && gameState.currentSolution) {
          solution = gameState.currentSolution;
        }
      }
    } catch (error) {
      console.warn('[tutor/coach] Could not retrieve solution for leak detection:', error);
      // Continue without solution - leak detection will be skipped
    }

    // Get strategy description
    const strategyDescription = getStrategyDescription(strategy);
    const systemPrompt = getCoachHowiePrompt(strategy, strategyDescription);

    // Format board for prompt
    const boardText = formatBoardForPrompt(board, puzzle, highlightedCell);

    // Build messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add chat history if provided
    if (Array.isArray(chatHistory)) {
      chatHistory.forEach(msg => {
        if (msg.role && msg.content) {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }

    // Add current board state and user message
    messages.push({
      role: 'user',
      content: `${boardText}\n\nUser: ${message || 'Get help with this puzzle'}`
    });

    // Try to get a response without leaks (with retries)
    let response = null;
    let leakedAnswer = false;
    let attempts = 0;

    while (attempts < MAX_RETRIES + 1) {
      attempts++;

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7, // Slightly higher for more natural conversation
          max_tokens: 200 // Limit response length for conciseness
        });

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
          return NextResponse.json(
            { error: 'AI_ERROR', message: 'No response from AI' },
            { status: 500 }
          );
        }

        // Check for answer leaks
        leakedAnswer = checkForAnswerLeak(responseContent, solution, highlightedCell);

        if (!leakedAnswer) {
          // No leak detected, use this response
          response = responseContent;
          break;
        } else {
          // Leak detected, add a warning to the system prompt and retry
          console.warn(`[tutor/coach] Answer leak detected on attempt ${attempts}, retrying...`);

          if (attempts < MAX_RETRIES + 1) {
            // Update system prompt with stricter instructions
            messages[0] = {
              role: 'system',
              content: `${systemPrompt}\n\nCRITICAL: Your previous response may have leaked the answer. You MUST NOT mention any specific digits that could be the answer. Guide the student through questions only. Do not confirm or suggest any numbers.`
            };
          }
        }
      } catch (error) {
        console.error('[tutor/coach] OpenAI API error:', error);
        if (error instanceof OpenAI.APIError) {
          return NextResponse.json(
            { error: 'AI_ERROR', message: error.message },
            { status: 500 }
          );
        }
        throw error;
      }
    }

    // If we still have a leak after retries, return error
    if (leakedAnswer) {
      console.error('[tutor/coach] Answer leak detected after all retries');
      return NextResponse.json(
        { error: 'LEAK_DETECTED', message: 'Unable to generate safe response. Please try again.' },
        { status: 500 }
      );
    }

    // If no response after retries, return error
    if (!response) {
      return NextResponse.json(
        { error: 'AI_ERROR', message: 'Failed to generate response' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response: response,
      leakedAnswer: false
    });

  } catch (error) {
    console.error('[tutor/coach] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}









