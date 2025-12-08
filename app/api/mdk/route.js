import { NextResponse } from 'next/server';
import { handleMdkWebhook } from '@/lib/webhookHandler';

/**
 * Money Dev Kit webhook endpoint
 * Uses custom webhook handler for signature verification and Redis storage
 */
export async function POST(request) {
  return handleMdkWebhook(request);
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
