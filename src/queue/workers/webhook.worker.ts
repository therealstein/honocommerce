/**
 * Webhook Delivery Worker
 * Processes webhook delivery jobs from BullMQ or memory queue
 */

import { Worker, Job } from 'bullmq';
import { 
  connection, 
  QUEUE_NAMES, 
  isQueueEnabled,
  registerMemoryWorker,
} from '../index';
import { deliverWebhook } from '../../webhooks/dispatcher';

interface WebhookJobData {
  deliveryId: string;
  webhookId: number;
  payload: Record<string, unknown>;
}

let worker: Worker<WebhookJobData> | null = null;

/**
 * Process webhook delivery job
 */
const processWebhookDelivery = async (data: WebhookJobData): Promise<void> => {
  const { deliveryId } = data;
  
  console.log(`🔗 Processing webhook delivery: ${deliveryId}`);
  
  const success = await deliverWebhook(deliveryId);
  
  if (!success) {
    throw new Error(`Webhook delivery failed: ${deliveryId}`);
  }
};

/**
 * Start the webhook worker
 */
export const startWebhookWorker = (): void => {
  // Always register handler for memory queue fallback
  registerMemoryWorker(QUEUE_NAMES.WEBHOOK, async (data) => {
    try {
      await processWebhookDelivery(data as WebhookJobData);
    } catch (error) {
      console.error('Memory queue webhook failed:', error);
    }
  });

  if (!isQueueEnabled() || !connection) {
    console.log('📦 Webhook worker using in-memory queue');
    return;
  }

  worker = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOK,
    async (job: Job<WebhookJobData>) => {
      await processWebhookDelivery(job.data);
      return { success: true, deliveryId: job.data.deliveryId };
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000, // 100 requests per second
      },
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`✅ Webhook delivery completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Webhook delivery failed: ${job?.id}`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Webhook worker error:', err);
  });

  console.log('🔄 Webhook worker started (Redis)');
};

/**
 * Stop the webhook worker
 */
export const stopWebhookWorker = async (): Promise<void> => {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('Webhook worker stopped');
  }
};

export default {
  start: startWebhookWorker,
  stop: stopWebhookWorker,
};
