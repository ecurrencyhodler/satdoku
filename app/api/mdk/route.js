import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';
import { NextResponse } from 'next/server';
import { storePayment } from '../../../lib/redis.js';

export async function POST(request) {
  // Clone request BEFORE mdkPost consumes it
  let eventData = null;

  try {
    const clonedRequest = request.clone();
    const bodyText = await clonedRequest.text();
    eventData = JSON.parse(bodyText);
    console.log('[webhook] Event data structure:', JSON.stringify(eventData, null, 2));
    console.log('[webhook] Event type fields:', {
      type: eventData?.type,
      event: eventData?.event,
      hasData: !!eventData?.data,
      hasDataObject: !!eventData?.data?.object,
      topLevelKeys: eventData ? Object.keys(eventData) : [],
    });
  } catch (error) {
    console.error('[webhook] Error reading request body:', error);
  }

  // Let MDK handle signature verification and webhook processing
  const mdkResponse = await mdkPost(request);
  
  // Store successful payment events in Redis
  if (mdkResponse.ok && eventData) {
    try {
      console.log('[webhook] Processing event - checking conditions:', {
        type: eventData?.type,
        event: eventData?.event,
        hasData: !!eventData?.data,
      });
      
      // Handle checkout.session.completed events (has full checkout session data)
      if (eventData?.type === 'checkout.session.completed') {
        console.log('[webhook] ✅ Matched checkout.session.completed event');
        const session = eventData.data?.object;
        console.log('[webhook] Session data:', {
          hasSession: !!session,
          sessionId: session?.id,
          metadataType: session?.metadata?.type,
          metadata: session?.metadata,
        });
        
        if (session?.metadata?.type === 'life_purchase' && session.id) {
          const checkoutId = session.id;
          console.log('[webhook] ✅ Session matches life_purchase criteria');
          
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
        } else {
          console.log('[webhook] ⚠️ Session does not match life_purchase criteria:', {
            hasMetadata: !!session?.metadata,
            metadataType: session?.metadata?.type,
            hasSessionId: !!session?.id,
          });
        }
      } else {
        console.log('[webhook] ⚠️ Event did not match any handler conditions:', {
          type: eventData?.type,
          event: eventData?.event,
          topLevelKeys: eventData ? Object.keys(eventData) : [],
        });
      }
    } catch (error) {
      // Logging is optional, don't fail on parse errors
      console.error('[webhook] Error processing payment event:', error);
      console.error('[webhook] Error stack:', error.stack);
      console.error('[webhook] Event data that caused error:', JSON.stringify(eventData, null, 2));
    }
  } else {
    console.log('[webhook] ⚠️ Skipping event processing:', {
      mdkResponseOk: mdkResponse?.ok,
      hasEventData: !!eventData,
      mdkResponseStatus: mdkResponse?.status,
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
