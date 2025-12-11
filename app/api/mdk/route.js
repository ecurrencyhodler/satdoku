import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';
import { NextResponse } from 'next/server';
import { storePayment, storeLightningPayment } from '../../../lib/redis.js';

/**
 * Parse PaymentReceived event from MDK's log string
 * Handles multiple formats:
 * 1. "[lightning-js] PaymentReceived payment_hash=... amount_msat=..."
 * 2. "[lightning-js] Event: PaymentReceived { payment_id: Some(...), payment_hash: ..., amount_msat: ... }"
 */
function parsePaymentReceivedFromLog(logMessage) {
  try {
    // Check if this log contains PaymentReceived
    if (!logMessage.includes('PaymentReceived')) {
      return null;
    }

    const result = {};

    // Format 1: Simple format "PaymentReceived payment_hash=... amount_msat=..."
    // Example: "[lightning-js] PaymentReceived payment_hash=5749aee6174b4e62beb72345eb024c941f1d9974a4b9f6259ac6ec7df0a56382 amount_msat=10780"
    const simpleFormatMatch = logMessage.match(/PaymentReceived\s+payment_hash=([a-f0-9]+)\s+amount_msat=(\d+)/);
    if (simpleFormatMatch) {
      result.paymentHash = simpleFormatMatch[1].trim();
      result.amountMsat = parseInt(simpleFormatMatch[2], 10);
      return result;
    }

    // Format 2: Struct format "PaymentReceived { payment_id: Some(...), payment_hash: ..., amount_msat: ... }"
    const structMatch = logMessage.match(/PaymentReceived\s*\{([^}]+)\}/);
    if (structMatch) {
      const content = structMatch[1];

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
    }

    return null;
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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:67',message:'Setting up console interceptors',data:{eventType:eventData?.event,hasEventData:!!eventData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Shared interceptor function for both log and error
  const createInterceptor = (originalFn, interceptorType) => {
    return (...args) => {
      // Call original function FIRST - ensures logs still appear in Vercel
      originalFn(...args);
      
      // #region agent log
      const logMessage = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      const isPaymentRelated = logMessage.includes('PaymentReceived') || logMessage.includes('[lightning-js]');
      fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:75',message:'Console interceptor called',data:{type:interceptorType,isPaymentRelated,logMessage:logMessage.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Check if this is a PaymentReceived log and capture the data
      if (isPaymentRelated) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:82',message:'Payment-related log detected',data:{logMessage:logMessage.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        const paymentData = parsePaymentReceivedFromLog(logMessage);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:84',message:'Parsed payment data',data:{paymentData,hasPaymentHash:!!paymentData?.paymentHash},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        if (paymentData && paymentData.paymentHash) {
          capturedPayments.push(paymentData);
          originalLog('[webhook] ✅ Captured PaymentReceived event from log:', paymentData);
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:88',message:'Payment added to capturedPayments',data:{paymentHash:paymentData.paymentHash,amountMsat:paymentData.amountMsat,capturedCount:capturedPayments.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
        }
      }
    };
  };

  const logInterceptor = createInterceptor(originalLog, 'log');
  const errorInterceptor = createInterceptor(originalError, 'error');

  // Temporarily override both console.log and console.error during MDK processing
  console.log = logInterceptor;
  console.error = errorInterceptor;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:103',message:'About to call mdkPost',data:{capturedPaymentsCount:capturedPayments.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  let mdkResponse;
  try {
    // Let MDK handle signature verification and webhook processing
    // During this call, MDK will log PaymentReceived events which we'll capture
    mdkResponse = await mdkPost(request);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:110',message:'mdkPost completed',data:{capturedPaymentsCount:capturedPayments.length,responseOk:mdkResponse?.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  } finally {
    // Always restore original console functions, even if there's an error
    console.log = originalLog;
    console.error = originalError;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:116',message:'Console interceptors restored',data:{capturedPaymentsCount:capturedPayments.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:110',message:'Processing captured payments',data:{capturedPaymentsCount:capturedPayments.length,capturedPayments:capturedPayments},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

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
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:196',message:'Processing incoming-payment event',data:{eventData:JSON.stringify(eventData).substring(0,500),capturedPaymentsCount:capturedPayments.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // Extract payment data from the event
        // The structure may vary, so we'll check multiple possible locations
        const paymentData = eventData.data?.object || eventData.data || eventData;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:202',message:'Extracted paymentData from event',data:{paymentDataKeys:Object.keys(paymentData),paymentDataStr:JSON.stringify(paymentData).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
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
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/888a85b2-944a-43f1-8747-68d69a3f19fc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.js:218',message:'Final extracted payment fields',data:{paymentId:paymentId||null,paymentHash:paymentHash||null,amountMsat:amountMsat||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
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
