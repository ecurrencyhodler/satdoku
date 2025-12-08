import { handleMdkWebhook } from '@/lib/webhookHandler';

/**
 * Unified Money Dev Kit webhook endpoint
 * Handles webhook signature verification and stores purchase tokens in Redis
 */
export async function POST(request) {
  return handleMdkWebhook(request);
}

