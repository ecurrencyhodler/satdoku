import { POST as mdkPost } from '@moneydevkit/nextjs/server/route';
import { NextResponse } from 'next/server';
import { getCheckoutSession, isCheckoutProcessed, markCheckoutProcessed } from '../../../lib/redis/checkoutTracking.js';
import { getGameState } from '../../../lib/redis/gameState.js';
import { handlePurchaseLife } from '../../../lib/game/actionHandlers/purchaseLife.js';

export async function POST(request) {
  // Read the request body as text (can only be read once)
  // We need to store it since we'll recreate the request for MDK's handler
  let bodyText;
  
  try {
    bodyText = await request.text();
    
    // SECURITY: Verify signature FIRST before processing any webhook logic
    // Recreate the request with the same body and headers for MDK
    const newRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: bodyText,
    });
    
    // Let MDK handle signature verification and webhook processing
    const mdkResponse = await mdkPost(newRequest);
    
    // Only process webhook if MDK verified the signature (status 200/201)
    // If signature is invalid, MDK will return an error status and we skip processing
    if (mdkResponse.status !== 200 && mdkResponse.status !== 201) {
      console.warn('[webhook] MDK rejected webhook (invalid signature or other error):', mdkResponse.status);
      return mdkResponse; // Return MDK's response without processing
    }
    
    // Signature is verified - now safe to process the webhook
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('[webhook] Failed to parse webhook body after signature verification:', parseError);
      // Signature was valid but body is invalid - return MDK's response
      return mdkResponse;
    }
    
    // Check if this is a checkout.paid event
    if (body.type === 'checkout.paid' && body.data?.id) {
      const checkoutId = body.data.id;
      
      console.log('[webhook] Processing verified checkout.paid event:', checkoutId);
      
      // Look up sessionId from checkout mapping
      const sessionId = await getCheckoutSession(checkoutId);
      
      if (!sessionId) {
        console.error('[webhook] CRITICAL: No session mapping found for checkout:', checkoutId);
        console.error('[webhook] This means the checkout page did not store the mapping before payment completed.');
        console.error('[webhook] The webhook will be retried by MDK, but the mapping must be stored first.');
        // Webhook was valid, we just can't grant a life without session mapping
        // MDK will retry the webhook, so if the mapping gets stored later, it will work
        return mdkResponse;
      }
      
      // Check if already processed (idempotency)
      const alreadyProcessed = await isCheckoutProcessed(checkoutId);
      
      if (alreadyProcessed) {
        console.log('[webhook] Checkout already processed, skipping:', checkoutId);
        return mdkResponse;
      }
      
      // Grant life to the session
      const gameState = await getGameState(sessionId);
      
      if (!gameState) {
        console.warn('[webhook] No game state found for session:', sessionId, 'checkout:', checkoutId);
        return mdkResponse;
      }
      
      try {
        // Use existing handlePurchaseLife function to grant life
        const result = await handlePurchaseLife(
          sessionId,
          gameState,
          { action: 'purchaseLife', checkoutId },
          gameState.version || null
        );
        
        if (result.success) {
          // Mark checkout as processed
          await markCheckoutProcessed(checkoutId);
          console.log('[webhook] Successfully granted life for checkout:', checkoutId, 'session:', sessionId);
        } else {
          console.error('[webhook] Failed to grant life:', result.error, 'checkout:', checkoutId, 'session:', sessionId);
        }
      } catch (error) {
        console.error('[webhook] Error granting life:', error, 'checkout:', checkoutId, 'session:', sessionId);
      }
    }
    
    return mdkResponse;
  } catch (error) {
    console.error('[webhook] Error processing webhook:', error);
    // Try to pass to MDK handler for signature verification even on error
    // This ensures we don't process invalid requests
    if (bodyText) {
      try {
        const newRequest = new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: bodyText,
        });
        // Let MDK verify signature - if it fails, we return the error response
        return await mdkPost(newRequest);
      } catch (mdkError) {
        console.error('[webhook] MDK handler also failed:', mdkError);
      }
    }
    // If we can't recover, return error
    return NextResponse.json(
      { error: 'Webhook processing failed' },
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
