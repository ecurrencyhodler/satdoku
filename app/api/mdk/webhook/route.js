import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { set, get } from '@/lib/redis';

/**
 * Verify webhook signature using HMAC-SHA256
 * Supports both simple signature and timestamp-based signature formats
 */
function verifyWebhookSignature(body, signature, secret, timestamp = null) {
  if (!signature || !secret) {
    throw new Error('Missing signature or secret');
  }

  let signedContent = body;
  
  // If timestamp is provided, use timestamp.body format (common webhook pattern)
  if (timestamp) {
    signedContent = `${timestamp}.${body}`;
  }

  // Compute expected signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedContent);
  const expectedSignature = hmac.digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  // Handle both hex string and buffer formats
  let signatureBuffer;
  try {
    signatureBuffer = Buffer.from(signature, 'hex');
  } catch (e) {
    // If hex parsing fails, try treating it as a raw string
    signatureBuffer = Buffer.from(signature);
  }
  
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  
  if (signatureBuffer.length !== expectedBuffer.length) {
    throw new Error('Invalid webhook signature length');
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error('Invalid webhook signature');
  }

  // Parse and return the event
  return JSON.parse(body);
}

/**
 * Webhook handler for MoneyDevKit payment events
 * Verifies payments server-side and stores purchase tokens in Redis
 */
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get('mdk-signature') || request.headers.get('moneydevkit-signature');
  const timestamp = request.headers.get('moneydevkit-timestamp');

  try {
    // Verify webhook signature
    const event = verifyWebhookSignature(
      body,
      signature,
      process.env.MDK_WEBHOOK_SECRET,
      timestamp
    );

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Check if this is a life purchase
      if (session.metadata?.type === 'life_purchase') {
        const checkoutId = session.id;
        const purchaseKey = `purchase:${checkoutId}`;
        
        // Idempotency check: if token already exists, this is a duplicate webhook call
        // Return success without error (webhooks can be called multiple times)
        try {
          const existingToken = await get(purchaseKey);
          if (existingToken) {
            console.log(`Purchase token already exists for checkout: ${checkoutId} (idempotent webhook call)`);
            return NextResponse.json({ 
              received: true,
              checkoutId,
              alreadyProcessed: true
            });
          }
        } catch (redisError) {
          // If check fails, continue to try storing (might be transient error)
          console.warn('Failed to check existing token during idempotency check:', redisError);
        }
        
        // Store purchase token in Redis with 24 hour expiration
        // Key format: purchase:{checkoutId}
        // Value: timestamp when payment was verified
        const purchaseTimestamp = Date.now();
        try {
          await set(purchaseKey, purchaseTimestamp, {
            ex: 60 * 60 * 24, // Expires in 24 hours
          });
          
          console.log(`Purchase token stored for checkout: ${checkoutId}`);
          
          return NextResponse.json({ 
            received: true,
            checkoutId 
          });
        } catch (redisError) {
          console.error('Failed to store purchase token in Redis:', redisError);
          // Return 500 to trigger webhook retry from MoneyDevKit
          return NextResponse.json(
            { error: 'Failed to store purchase token', checkoutId },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook verification failed:', error);
    // Log full error details for debugging
    if (error.message) {
      console.error('Error message:', error.message);
    }
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }
}
