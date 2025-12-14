import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';

/**
 * MDK webhook endpoint
 * 
 * Life purchases are now handled client-side via isCheckoutPaid from useCheckoutSuccess().
 * This endpoint just passes through to MDK for signature verification and any other webhook processing.
 */
export async function POST(request) {
  // Pass through to MDK handler for signature verification
  // We no longer process life purchases here - they're handled client-side
  return await mdkPost(request);
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
