import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@moneydevkit/nextjs/server';
import { kv } from '@vercel/kv';

/**
 * Webhook handler for MoneyDevKit payment events
 * Verifies payments server-side and stores purchase tokens in Vercel KV
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
        
        // Store purchase token in Vercel KV with 24 hour expiration
        // Key format: purchase:{checkoutId}
        // Value: timestamp when payment was verified
        await kv.set(`purchase:${checkoutId}`, timestamp, {
          ex: 60 * 60 * 24, // Expires in 24 hours
        });
        
        return NextResponse.json({ 
          received: true,
          checkoutId 
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }
}

