import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';
import { NextResponse } from 'next/server';
import { set } from '@/lib/redis';

/**
 * Unified Money Dev Kit webhook endpoint
 * Uses MDK's default handler for signature verification, then adds custom Redis logic
 */
export async function POST(request) {
  // Clone request to preserve body for both MDK handler and our custom logic
  const clonedRequest = request.clone();
  
  // Parse body first to get event data (before MDK consumes it)
  let eventData = null;
  try {
    const bodyText = await clonedRequest.text();
    eventData = JSON.parse(bodyText);
  } catch (error) {
    console.error('[webhook] Failed to parse request body:', error);
    // Still let MDK handle it - it will return proper error
  }

  // Let MDK handle signature verification
  const mdkResponse = await mdkPost(request);
  
  // If MDK handler failed (signature verification failed), return early
  if (!mdkResponse.ok) {
    return mdkResponse;
  }

  // MDK verified the signature successfully, now add our custom Redis logic
  if (eventData?.type === 'checkout.session.completed') {
    const session = eventData.data?.object;
    
    if (session?.metadata?.type === 'life_purchase' && session.id) {
      const checkoutId = session.id;
      const purchaseKey = `purchase:${checkoutId}`;
      
      try {
        // Store purchase token in Redis with 24 hour expiration
        await set(purchaseKey, Date.now(), {
          ex: 60 * 60 * 24, // 24 hours
        });
        
        console.log(`[webhook] Purchase token stored successfully for checkout: ${checkoutId}`);
      } catch (redisError) {
        console.error('[webhook] Failed to store purchase token in Redis:', redisError);
        // Don't fail the webhook - MDK already verified it
        // Token storage failure is logged but doesn't prevent webhook success
      }
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
