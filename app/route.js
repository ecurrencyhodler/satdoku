import { handleMdkWebhook } from '@/lib/webhookHandler';
import { NextResponse } from 'next/server';

/**
 * Root-level route handler for MoneyDevKit webhooks
 * 
 * This handles webhooks sent to https://satdoku.vercel.app
 * GET requests are handled by app/page.js (the game page)
 * POST requests are handled here (webhook events)
 */
export async function POST(request) {
  // Check if this looks like a MoneyDevKit webhook
  const signature = request.headers.get('mdk-signature') || request.headers.get('moneydevkit-signature');
  
  if (signature) {
    // This is a MoneyDevKit webhook, handle it
    console.log('[webhook] Received webhook at root path');
    return handleMdkWebhook(request);
  }
  
  // Not a webhook, return 404
  return NextResponse.json(
    { error: 'Not found' },
    { status: 404 }
  );
}
