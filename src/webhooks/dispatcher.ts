/**
 * Webhook Dispatcher
 * Outbound webhook fan-out
 */

import { db } from '../db';
import { webhooks, webhookDeliveries } from '../db/schema/webhooks';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import { queueWebhookDelivery, isQueueEnabled } from '../queue';

export interface WebhookPayload {
  topic: string;
  resource: string;
  event: string;
  data: Record<string, unknown>;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
const generateSignature = (payload: string, secret: string): string => {
  return createHmac('sha256', secret).update(payload).digest('base64');
};

/**
 * Get active webhooks for a topic
 */
export const getWebhooksForTopic = async (topic: string): Promise<typeof webhooks.$inferSelect[]> => {
  return db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.topic, topic),
        eq(webhooks.status, 'active'),
        eq(webhooks.isDeleted, false)
      )
    );
};

/**
 * Dispatch a webhook to all subscribers
 */
export const dispatchWebhook = async (payload: WebhookPayload): Promise<void> => {
  const { topic, resource, event, data } = payload;
  
  // Get all active webhooks for this topic
  const subscribers = await getWebhooksForTopic(topic);
  
  if (subscribers.length === 0) {
    console.log(`No webhooks subscribed to ${topic}`);
    return;
  }
  
  console.log(`Dispatching webhook ${topic} to ${subscribers.length} subscriber(s)`);
  
  // Dispatch to each subscriber
  await Promise.all(
    subscribers.map(async (webhook) => {
      const deliveryId = randomUUID();
      const bodyString = JSON.stringify(data);
      const signature = generateSignature(bodyString, webhook.secret);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Source': process.env.WEBHOOK_SOURCE || 'https://honocommerce.local/',
        'X-WC-Webhook-Topic': topic,
        'X-WC-Webhook-Resource': resource,
        'X-WC-Webhook-Event': event,
        'X-WC-Webhook-Signature': signature,
        'X-WC-Webhook-ID': String(webhook.id),
        'X-WC-Webhook-Delivery-ID': deliveryId,
      };
      
      // Create delivery log
      await db.insert(webhookDeliveries).values({
        webhookId: webhook.id,
        deliveryId,
        status: 'pending',
        requestBody: data,
        requestHeaders: headers,
        retryCount: 0,
      });
      
      // Queue for async delivery (or sync fallback)
      await queueWebhookDelivery(deliveryId, webhook.id, data);
    })
  );
};

/**
 * Deliver a webhook (called by worker)
 */
export const deliverWebhook = async (deliveryId: string): Promise<boolean> => {
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.deliveryId, deliveryId))
    .limit(1);
  
  if (!delivery) {
    console.error(`Delivery not found: ${deliveryId}`);
    return false;
  }
  
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, delivery.webhookId))
    .limit(1);
  
  if (!webhook) {
    console.error(`Webhook not found: ${delivery.webhookId}`);
    return false;
  }
  
  console.log(`Delivering webhook ${webhook.id} to ${webhook.deliveryUrl}`);
  
  try {
    const response = await fetch(webhook.deliveryUrl, {
      method: 'POST',
      headers: delivery.requestHeaders as Record<string, string>,
      body: JSON.stringify(delivery.requestBody),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
    
    const responseBody = await response.text();
    
    // Update delivery log
    await db
      .update(webhookDeliveries)
      .set({
        status: response.ok ? 'delivered' : 'failed',
        responseBody,
        responseCode: response.status,
        dateCompleted: new Date(),
      })
      .where(eq(webhookDeliveries.deliveryId, deliveryId));
    
    if (!response.ok) {
      console.error(`Webhook delivery failed with status ${response.status}: ${responseBody}`);
    }
    
    return response.ok;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`Webhook delivery error: ${errorMessage}`);
    
    // Update delivery log with error
    await db
      .update(webhookDeliveries)
      .set({
        status: 'failed',
        errorMessage,
        retryCount: delivery.retryCount + 1,
        dateCompleted: new Date(),
      })
      .where(eq(webhookDeliveries.deliveryId, deliveryId));
    
    return false;
  }
};

export const webhookDispatcher = {
  dispatch: dispatchWebhook,
  deliver: deliverWebhook,
  getWebhooksForTopic,
};

export default webhookDispatcher;
