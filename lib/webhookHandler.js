import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { set } from '@/lib/redis';

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
 * Handle MoneyDevKit webhook events
 * This function can be used by multiple route handlers
 */
export async function handleMdkWebhook(request) {
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
      console.log('[webhook] Received checkout.session.completed event for session:', session.id);
      console.log('[webhook] Session metadata:', session.metadata);
      
      // Check if this is a life purchase
      if (session.metadata?.type === 'life_purchase') {
        const checkoutId = session.id;
        const purchaseTimestamp = Date.now();
        const purchaseKey = `purchase:${checkoutId}`;
        
        console.log('[webhook] Processing life purchase for checkoutId:', checkoutId);
        console.log('[webhook] Storing token with key:', purchaseKey);
        
        // Store purchase token in Redis with 24 hour expiration
        // Key format: purchase:{checkoutId}
        // Value: timestamp when payment was verified
        try {
          await set(purchaseKey, purchaseTimestamp, {
            ex: 60 * 60 * 24, // Expires in 24 hours
          });
          
          console.log(`[webhook] Purchase token stored successfully for checkout: ${checkoutId}`);
          
          return NextResponse.json({ 
            received: true,
            checkoutId 
          });
        } catch (redisError) {
          console.error('[webhook] Failed to store purchase token in Redis:', redisError);
          // Return 500 to trigger webhook retry from MoneyDevKit
          return NextResponse.json(
            { error: 'Failed to store purchase token', checkoutId },
            { status: 500 }
          );
        }
      } else {
        console.log('[webhook] Session is not a life purchase, metadata.type:', session.metadata?.type);
      }
    } else {
      console.log('[webhook] Event type is not checkout.session.completed:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[webhook] Webhook verification failed:', error);
    // Log full error details for debugging
    if (error.message) {
      console.error('[webhook] Error message:', error.message);
    }
    if (error.stack) {
      console.error('[webhook] Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }
}
