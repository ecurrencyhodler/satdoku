import { handleMdkWebhook } from '@/lib/webhookHandler';

/**
 * Webhook handler for MoneyDevKit payment events
 * Verifies payments server-side and stores purchase tokens in Redis
 * 
 * Note: Webhooks are configured to use the root URL (https://satdoku.vercel.app),
 * but this endpoint is kept for backwards compatibility if needed.
 */
export async function POST(request) {
  return handleMdkWebhook(request);
}
