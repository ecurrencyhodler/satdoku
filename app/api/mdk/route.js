import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';
import { NextResponse } from 'next/server';
import { storePayment } from '../../../lib/redis.js';

/**
 * Money Dev Kit webhook endpoint
 * Uses MDK's default handler for signature verification
 */
export async function POST(request) {
  // Let MDK handle signature verification and webhook processing
  const mdkResponse = await mdkPost(request);
  
  // Store successful payment events in Redis
  if (mdkResponse.ok) {
    try {
      const clonedRequest = request.clone();
      const bodyText = await clonedRequest.text();
      const eventData = JSON.parse(bodyText);
      
      if (eventData?.type === 'checkout.session.completed') {
        const session = eventData.data?.object;
        if (session?.metadata?.type === 'life_purchase' && session.id) {
          const checkoutId = session.id;
          
          // Extract all relevant payment fields from the session
          const paymentData = {
            checkoutId,
            // Amount information
            amount: session.amount_total || session.amount,
            amountMsat: session.amount_total_msat,
            currency: session.currency || 'SAT',
            // Status and metadata
            status: session.status,
            paymentStatus: session.payment_status,
            paymentMethod: session.payment_method,
            // Timestamps
            createdAt: session.created_at ? new Date(session.created_at * 1000).toISOString() : new Date().toISOString(),
            completedAt: session.completed_at ? new Date(session.completed_at * 1000).toISOString() : new Date().toISOString(),
            // Metadata
            metadata: session.metadata || {},
            // Lightning payment details (if available)
            paymentHash: session.payment_hash,
            paymentId: session.payment_id,
            invoice: session.invoice,
            // Additional fields
            customer: session.customer,
            successUrl: session.success_url,
            cancelUrl: session.cancel_url,
            // Webhook event info
            eventType: eventData.type,
            eventId: eventData.id,
            webhookReceivedAt: new Date().toISOString(),
          };

          const stored = await storePayment(checkoutId, paymentData);
          
          if (stored) {
            console.log(`[webhook] Payment stored in Redis for checkout: ${checkoutId}`, {
              amount: paymentData.amount,
              currency: paymentData.currency,
              status: paymentData.status,
            });
          } else {
            console.warn(`[webhook] Failed to store payment in Redis for checkout: ${checkoutId}`);
          }
        }
      }
    } catch (error) {
      // Logging is optional, don't fail on parse errors
      console.error('[webhook] Error processing payment event:', error);
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
