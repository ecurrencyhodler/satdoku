import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';
import { NextResponse } from 'next/server';

/**
 * Money Dev Kit webhook endpoint
 * Uses MDK's default handler for signature verification
 */
export async function POST(request) {
  // Let MDK handle signature verification and webhook processing
  const mdkResponse = await mdkPost(request);
  
  // Log successful payment events (optional)
  if (mdkResponse.ok) {
    try {
      const clonedRequest = request.clone();
      const bodyText = await clonedRequest.text();
      const eventData = JSON.parse(bodyText);
      
      if (eventData?.type === 'checkout.session.completed') {
        const session = eventData.data?.object;
        if (session?.metadata?.type === 'life_purchase' && session.id) {
          console.log(`[webhook] Payment confirmed for checkout: ${session.id}`);
        }
      }
    } catch (error) {
      // Logging is optional, don't fail on parse errors
      console.log('[webhook] Payment processed successfully');
    }
  }
  
  return mdkResponse;
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
