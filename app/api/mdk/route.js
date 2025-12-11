import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';
import { NextResponse } from 'next/server';
import { storePayment, storeLightningPayment } from '../../../lib/redis.js';

/**
 * Parse PaymentReceived event from MDK's log string
 * Example log: "[lightning-js] Event: PaymentReceived { payment_id: Some(...), payment_hash: ..., amount_msat: ... }"
 */
function parsePaymentReceivedFromLog(logMessage) {
  try {
    // Check if this log contains PaymentReceived
    if (!logMessage.includes('PaymentReceived')) {
      return null;
    }

    // Try to match the PaymentReceived event structure
    const match = logMessage.match(/PaymentReceived\s*\{([^}]+)\}/);
    if (!match) return null;

    const content = match[1];
    const result = {};

    // Extract payment_id (handles Some(...) wrapper or direct value)
    const paymentIdMatch = content.match(/payment_id:\s*Some\(([^)]+)\)|payment_id:\s*([^,}]+)/);
    if (paymentIdMatch) {
      result.paymentId = (paymentIdMatch[1] || paymentIdMatch[2]).trim();
    }

    // Extract payment_hash
    const paymentHashMatch = content.match(/payment_hash:\s*([a-f0-9]+)/);
    if (paymentHashMatch) {
      result.paymentHash = paymentHashMatch[1].trim();
    }

    // Extract amount_msat
    const amountMsatMatch = content.match(/amount_msat:\s*(\d+)/);
    if (amountMsatMatch) {
      result.amountMsat = parseInt(amountMsatMatch[1], 10);
    }

    // Only return if we have at least payment_hash
    return result.paymentHash ? result : null;
  } catch (error) {
    console.error('[webhook] Error parsing PaymentReceived from log:', error);
    return null;
  }
}

/**
 * Money Dev Kit webhook endpoint
 * Uses MDK's default handler for signature verification
 */
export async function POST(request) {
  // Clone request BEFORE mdkPost consumes it
  let eventData = null;
  const capturedPayments = [];

  try {
    const clonedRequest = request.clone();
    const bodyText = await clonedRequest.text();
    eventData = JSON.parse(bodyText);
    console.log('[webhook] Event data structure:', eventData);
  } catch (error) {
    console.error('[webhook] Error reading request body:', error);
  }

  // Intercept console.log and console.error to capture PaymentReceived events from MDK's logs
  const originalLog = console.log;
  const originalError = console.error;
  
  // Shared interceptor function for both log and error
  const createInterceptor = (originalFn) => {
    return (...args) => {
      // Call original function FIRST - ensures logs still appear in Vercel
      originalFn(...args);
      
      // Check if this is a PaymentReceived log and capture the data
      const logMessage = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      
      if (logMessage.includes('PaymentReceived') || logMessage.includes('[lightning-js]')) {
        const paymentData = parsePaymentReceivedFromLog(logMessage);
        if (paymentData && paymentData.paymentHash) {
          capturedPayments.push(paymentData);
          originalLog('[webhook] ✅ Captured PaymentReceived event from log:', paymentData);
        }
      }
    };
  };

  const logInterceptor = createInterceptor(originalLog);
  const errorInterceptor = createInterceptor(originalError);

  // Temporarily override both console.log and console.error during MDK processing
  console.log = logInterceptor;
  console.error = errorInterceptor;

  let mdkResponse;
  try {
    // Let MDK handle signature verification and webhook processing
    // During this call, MDK will log PaymentReceived events which we'll capture
    mdkResponse = await mdkPost(request);
  } finally {
    // Always restore original console functions, even if there's an error
    console.log = originalLog;
    console.error = originalError;
  }

  // Process captured PaymentReceived events and store in Redis
  for (const payment of capturedPayments) {
    try {
      const redisKey = `lightning:payment:${payment.paymentHash}`;
      const lightningPaymentData = {
        paymentId: payment.paymentId || payment.paymentHash,
        paymentHash: payment.paymentHash,
        amountMsat: payment.amountMsat,
        eventType: 'PaymentReceived',
        source: 'log_interception',
        capturedAt: new Date().toISOString(),
      };

      const stored = await storeLightningPayment(payment.paymentHash, lightningPaymentData);
      
      if (stored) {
        console.log(`[webhook] ✅ PaymentReceived stored in Redis from log`, {
          redisKey,
          paymentHash: payment.paymentHash,
          paymentId: payment.paymentId,
          amountMsat: payment.amountMsat,
        });
      } else {
        console.warn(`[webhook] ❌ Failed to store captured PaymentReceived in Redis`, {
          paymentHash: payment.paymentHash,
        });
      }
    } catch (error) {
      console.error('[webhook] Error storing captured PaymentReceived:', error);
    }
  }
  
  // Store successful payment events in Redis
  if (mdkResponse.ok && eventData) {
    try {
      // Handle checkout.session.completed events (has full checkout session data)
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
      // Handle incoming-payment events (Lightning notifications)
      else if (eventData?.event === 'incoming-payment' || eventData?.type === 'payment_received') {
        console.log('[webhook] Received incoming-payment/payment_received event');
        
        // Extract payment data from the event
        // The structure may vary, so we'll check multiple possible locations
        const paymentData = eventData.data?.object || eventData.data || eventData;
        
        // Extract the fields we need: payment_id, payment_hash, amount_msat
        // Handle payment_id which might be wrapped in Some() or be a direct value
        let paymentId = paymentData.payment_id;
        if (paymentId && typeof paymentId === 'object') {
          // Handle Rust Option type serialization (Some(value) or None)
          paymentId = paymentId.value || paymentId.Some || paymentId;
        }
        
        const paymentHash = paymentData.payment_hash;
        const amountMsat = paymentData.amount_msat;
        
        // Log extracted fields for verification
        console.log('[webhook] Extracted payment fields:', {
          paymentId: paymentId || '(not provided)',
          paymentHash: paymentHash || '(missing)',
          amountMsat: amountMsat || '(not provided)',
        });
        
        // Only store if we have at least payment_hash (required unique identifier)
        if (paymentHash) {
          const redisKey = `lightning:payment:${paymentHash}`;
          console.log(`[webhook] Preparing to store in Redis with key: ${redisKey}`);
          
          const lightningPaymentData = {
            paymentId: paymentId || paymentHash, // Use payment_hash as fallback
            paymentHash: paymentHash,
            amountMsat: amountMsat,
            // Store the full event data for reference
            rawEvent: eventData,
            // Webhook event info
            eventType: eventData.event || eventData.type || 'incoming-payment',
            eventId: eventData.id,
            webhookReceivedAt: new Date().toISOString(),
          };

          const stored = await storeLightningPayment(paymentHash, lightningPaymentData);
          
          if (stored) {
            console.log(`[webhook] ✅ Lightning payment successfully stored in Redis`, {
              redisKey: redisKey,
              paymentHash,
              paymentId: paymentId || paymentHash,
              amountMsat,
              storedAt: new Date().toISOString(),
            });
          } else {
            console.warn(`[webhook] ❌ Failed to store lightning payment in Redis`, {
              redisKey: redisKey,
              paymentHash,
              paymentId,
              amountMsat,
            });
          }
        } else {
          console.warn('[webhook] incoming-payment event missing payment_hash, cannot store');
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
