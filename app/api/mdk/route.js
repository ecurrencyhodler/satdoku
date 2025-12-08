import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';
import { NextResponse } from 'next/server';
import { set } from '@/lib/redis';

/**
 * Unified Money Dev Kit webhook endpoint
 * Uses MDK's default handler for signature verification, then adds custom Redis logic
 */
export async function POST(request) {
  console.log('[webhook] Webhook received');
  
  // Clone request to preserve body for both MDK handler and our custom logic
  const clonedRequest = request.clone();
  
  // Parse body first to get event data (before MDK consumes it)
  let eventData = null;
  try {
    const bodyText = await clonedRequest.text();
    eventData = JSON.parse(bodyText);
    console.log('[webhook] Parsed event data:', {
      type: eventData?.type,
      hasData: !!eventData?.data,
      hasObject: !!eventData?.data?.object,
      sessionId: eventData?.data?.object?.id,
      metadata: eventData?.data?.object?.metadata
    });
  } catch (error) {
    console.error('[webhook] Failed to parse request body:', error);
    // Still let MDK handle it - it will return proper error
  }

  // Let MDK handle signature verification
  const mdkResponse = await mdkPost(request);
  
  // If MDK handler failed (signature verification failed), return early
  if (!mdkResponse.ok) {
    console.log('[webhook] MDK signature verification failed, status:', mdkResponse.status);
    return mdkResponse;
  }

  console.log('[webhook] MDK signature verification successful');

  // MDK verified the signature successfully, now add our custom Redis logic
  if (eventData?.type === 'checkout.session.completed') {
    console.log('[webhook] Event type matches checkout.session.completed');
    const session = eventData.data?.object;
    
    console.log('[webhook] Session data:', {
      id: session?.id,
      metadataType: session?.metadata?.type,
      fullMetadata: session?.metadata
    });
    
    if (session?.metadata?.type === 'life_purchase' && session.id) {
      const checkoutId = session.id;
      const purchaseKey = `purchase:${checkoutId}`;
      
      console.log('[webhook] Processing life purchase for checkoutId:', checkoutId);
      console.log('[webhook] Storing token with key:', purchaseKey);
      
      try {
        // Store purchase token in Redis with 24 hour expiration
        const timestamp = Date.now();
        await set(purchaseKey, timestamp, {
          ex: 60 * 60 * 24, // 24 hours
        });
        
        console.log(`[webhook] Purchase token stored successfully for checkout: ${checkoutId}, timestamp: ${timestamp}`);
      } catch (redisError) {
        console.error('[webhook] Failed to store purchase token in Redis:', redisError);
        console.error('[webhook] Redis error details:', {
          message: redisError.message,
          stack: redisError.stack,
          name: redisError.name
        });
        // Don't fail the webhook - MDK already verified it
        // Token storage failure is logged but doesn't prevent webhook success
      }
    } else {
      console.log('[webhook] Conditions not met for storing token:', {
        hasMetadata: !!session?.metadata,
        metadataType: session?.metadata?.type,
        expectedType: 'life_purchase',
        hasSessionId: !!session?.id
      });
    }
  } else {
    console.log('[webhook] Event type does not match checkout.session.completed:', eventData?.type);
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
