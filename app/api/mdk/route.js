import { NextResponse } from 'next/server';
import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';

/**
 * MDK webhook endpoint
 *
 * MDK automatically appends /api/mdk to the webhook URL you configure.
 * So if you set webhook URL to https://your-domain.com, MDK sends to https://your-domain.com/api/mdk
 *
 * Life purchases are now handled client-side via isCheckoutPaid from useCheckoutSuccess().
 * This endpoint just passes through to MDK for signature verification and any other webhook processing.
 */
export async function POST(request) {
  try {
    // Pass through to MDK handler for signature verification
    // The MDK library handles webhook signature verification automatically
    return await mdkPost(request);
  } catch (error) {
    // If signature verification fails, MDK will return an error response
    // We should pass it through rather than masking it
    if (error instanceof Response) {
      return error;
    }
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

// Reject all other HTTP methods with 405 Method Not Allowed
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
