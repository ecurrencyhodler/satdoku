import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getStrategySelectorPrompt, formatBoardForPrompt } from '../../../../lib/tutor/strategyPrompts.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/tutor/strategy
 * Analyzes board state and returns strategy selection (JSON only)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { board, highlightedCell } = body;

    // Validation: Check if board is provided
    if (!board) {
      return NextResponse.json(
        { error: 'NO_BOARD', message: 'No game board available' },
        { status: 400 }
      );
    }

    // Validation: Check if board is a 9x9 array
    if (!Array.isArray(board) || board.length !== 9) {
      return NextResponse.json(
        { error: 'INVALID_BOARD', message: 'Board must be a 9x9 array' },
        { status: 400 }
      );
    }

    // Validation: Check each row has 9 columns
    const isValidStructure = board.every(row =>
      Array.isArray(row) && row.length === 9
    );
    if (!isValidStructure) {
      return NextResponse.json(
        { error: 'INVALID_BOARD', message: 'Board structure invalid - each row must have 9 columns' },
        { status: 400 }
      );
    }

    // Check if board is empty (all zeros)
    const isEmpty = board.every(row =>
      row.every(cell => cell === 0)
    );

    // Format board for prompt
    const boardText = formatBoardForPrompt(board, board, highlightedCell);

    // Get strategy selector prompt
    const systemPrompt = getStrategySelectorPrompt();

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: boardText
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent strategy selection
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      return NextResponse.json(
        { error: 'AI_ERROR', message: 'No response from AI' },
        { status: 500 }
      );
    }

    // Parse JSON response
    let strategyResult;
    try {
      strategyResult = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('[tutor/strategy] Failed to parse AI response:', parseError);
      // If empty board, return default strategy
      if (isEmpty) {
        return NextResponse.json({
          strategy: 'exploratory_scan'
        });
      }
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Validate strategy is present
    if (!strategyResult.strategy) {
      // If empty board, return default strategy
      if (isEmpty) {
        return NextResponse.json({
          strategy: 'exploratory_scan'
        });
      }
      return NextResponse.json(
        { error: 'INVALID_RESPONSE', message: 'AI response missing strategy field' },
        { status: 500 }
      );
    }

    return NextResponse.json(strategyResult);

  } catch (error) {
    console.error('[tutor/strategy] Error:', error);

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: 'AI_ERROR', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}








