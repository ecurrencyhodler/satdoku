import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';
import { NextResponse } from 'next/server';
import { getRedisClient, generateIdempotencyKey, extractPaymentData } from '../../../lib/redis.js';

/**
 * Zero-Loss Webhook Flow
 * 
 * 1. Clone request immediately
 * 2. Read + store raw body in Redis in a PENDING state
 * 3. Forward original request to MDK for signature verification
 * 4. If verification fails → delete pending entry
 * 5. If verification succeeds → parse + process raw event
 * 6. Store as PROCESSED with idempotency
 * 7. Delete pending entry
 * 8. Return 200 ONLY AFTER safe storage
 */
export async function POST(request) {
  let pendingKey = null;
  let redis = null;
  
  try {
    // Step 1: Clone request immediately
    const clonedRequest = request.clone();
    
    // Step 2: Read + store raw body in Redis in a PENDING state
    const rawBody = await clonedRequest.text();
    const timestamp = Date.now();
    const requestId = `req_${timestamp}_${Math.random().toString(36).slice(2, 9)}`;
    pendingKey = `webhook:pending:${requestId}`;
    
    redis = await getRedisClient();
    
    // Store pending entry with raw body and metadata
    await redis.setEx(
      pendingKey,
      3600, // 1 hour TTL for pending entries
      JSON.stringify({
        status: 'PENDING',
        rawBody,
        timestamp,
        requestId,
      })
    );
    
    console.log(`[webhook] Stored pending entry: ${pendingKey}`);
    
    // Step 3: Forward original request to MDK for signature verification
    const mdkResponse = await mdkPost(request);
    
    // Step 4: If verification fails → delete pending entry
    if (!mdkResponse.ok) {
      console.log(`[webhook] MDK verification failed, deleting pending entry: ${pendingKey}`);
      await redis.del(pendingKey);
      return mdkResponse; // Return MDK's error response
    }
    
    // Step 5: If verification succeeds → parse + process raw event
    let eventData;
    try {
      eventData = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[webhook] Failed to parse event data:', parseError);
      await redis.del(pendingKey);
      return NextResponse.json(
        { error: 'Invalid event data format' },
        { status: 400 }
      );
    }
    
    // Debug: Log the event structure to understand what we're receiving
    console.log('[webhook] Event data structure:', JSON.stringify(eventData, null, 2));
    
    // Step 6: Store as PROCESSED with idempotency
    const idempotencyKey = generateIdempotencyKey(eventData);
    const processedKey = `webhook:processed:${idempotencyKey}`;
    
    // Check if already processed (idempotency check)
    const existingProcessed = await redis.get(processedKey);
    if (existingProcessed) {
      console.log(`[webhook] Event already processed (idempotency): ${idempotencyKey}`);
      // Delete pending entry and return success
      await redis.del(pendingKey);
      return NextResponse.json(
        { message: 'Event already processed', idempotencyKey },
        { status: 200 }
      );
    }
    
    // Store as PROCESSED with essential payment data only
    const paymentData = extractPaymentData(eventData);
    const processedData = {
      status: 'PROCESSED',
      payment: paymentData, // Only essential payment fields
      timestamp,
      requestId,
      idempotencyKey,
      processedAt: Date.now(),
    };
    
    await redis.setEx(
      processedKey,
      86400 * 7, // 7 days TTL for processed entries (sufficient for webhook idempotency)
      JSON.stringify(processedData)
    );
    
    console.log(`[webhook] Stored processed entry: ${processedKey}`);
    
    // Verification: Retrieve from Redis and log payment metadata
    const storedData = await redis.get(processedKey);
    if (storedData) {
      const parsed = JSON.parse(storedData);
      console.log('[webhook] Verification - Payment metadata stored in Redis:', JSON.stringify(parsed.payment, null, 2));
    } else {
      console.error('[webhook] WARNING - Failed to retrieve stored data from Redis for verification!');
    }
    
    // Step 7: Delete pending entry
    await redis.del(pendingKey);
    console.log(`[webhook] Deleted pending entry: ${pendingKey}`);
    
    // Step 8: Return 200 ONLY AFTER safe storage
    return NextResponse.json(
      { 
        message: 'Webhook processed successfully',
        idempotencyKey,
        eventType: eventData?.type,
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('[webhook] Error in zero-loss flow:', error);
    
    // Cleanup: try to delete pending entry if it exists
    if (pendingKey && redis) {
      try {
        await redis.del(pendingKey);
        console.log(`[webhook] Cleaned up pending entry after error: ${pendingKey}`);
      } catch (cleanupError) {
        console.error('[webhook] Failed to cleanup pending entry:', cleanupError);
      }
    }
    
    // Return error response
    return NextResponse.json(
      { error: 'Internal server error processing webhook' },
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
