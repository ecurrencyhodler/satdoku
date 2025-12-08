import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@moneydevkit/nextjs/server';
import { set } from '../../../lib/redis.js';

/**
 * Webhook handler for MoneyDevKit payment events
 * Verifies payments server-side and stores purchase tokens in Redis
 */
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get('mdk-signature');

  try {
    // Verify webhook signature
    const event = verifyWebhookSignature(
      body,
      signature,
      process.env.MDK_WEBHOOK_SECRET
    );

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Check if this is a life purchase
      if (session.metadata?.type === 'life_purchase') {
        const checkoutId = session.id;
        const timestamp = Date.now();
        
        // Store purchase token in Redis with 24 hour expiration
        // Key format: purchase:{checkoutId}
        // Value: timestamp when payment was verified
        try {
          await set(`purchase:${checkoutId}`, timestamp, {
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
