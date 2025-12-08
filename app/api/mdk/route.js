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
  let rawBody = null;
  try {
    rawBody = await clonedRequest.text();
    console.log('[webhook] Raw body length:', rawBody?.length);
    console.log('[webhook] Raw body preview (first 500 chars):', rawBody?.substring(0, 500));
    
    if (rawBody) {
      eventData = JSON.parse(rawBody);
      console.log('[webhook] Parsed event data:', {
        type: eventData?.type,
        hasData: !!eventData?.data,
        hasObject: !!eventData?.data?.object,
        sessionId: eventData?.data?.object?.id,
        metadata: eventData?.data?.object?.metadata,
        // Log full structure for debugging
        fullEvent: JSON.stringify(eventData).substring(0, 1000)
      });
    } else {
      console.log('[webhook] Raw body is empty or null');
    }
  } catch (error) {
    console.error('[webhook] Failed to parse request body:', error);
    console.error('[webhook] Raw body that failed to parse:', rawBody?.substring(0, 500));
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
  // Try multiple event structure formats that MDK might use
  let session = null;
  let eventType = null;
  
  if (eventData) {
    // Try standard format: { type: 'checkout.session.completed', data: { object: {...} } }
    if (eventData.type === 'checkout.session.completed' && eventData.data?.object) {
      eventType = eventData.type;
      session = eventData.data.object;
    }
    // Try alternative format: direct object
    else if (eventData.object && eventData.object.id) {
      eventType = 'checkout.session.completed';
      session = eventData.object;
    }
    // Try nested in data
    else if (eventData.data && typeof eventData.data === 'object' && eventData.data.id) {
      eventType = 'checkout.session.completed';
      session = eventData.data;
    }
  }
  
  if (eventType === 'checkout.session.completed' && session) {
    console.log('[webhook] Event type matches checkout.session.completed');
    console.log('[webhook] Session data:', {
      id: session?.id,
      metadataType: session?.metadata?.type,
      fullMetadata: session?.metadata,
      allKeys: Object.keys(session || {})
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
        hasSessionId: !!session?.id,
        sessionKeys: Object.keys(session || {})
      });
    }
  } else {
    console.log('[webhook] Event type does not match checkout.session.completed:', {
      eventType,
      hasSession: !!session,
      eventDataKeys: eventData ? Object.keys(eventData) : null
    });
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
