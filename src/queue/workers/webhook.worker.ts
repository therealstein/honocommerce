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
import logger from '../../lib/logger';

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
  
  logger.debug('Processing webhook delivery', { deliveryId });
  
  const success = await deliverWebhook(deliveryId);
  
  if (!success) {
    throw new Error(`Webhook delivery failed: ${deliveryId}`);
  }
};

/**
 * Start the webhook worker
 */
export const startWebhookWorker = (): void => {
  registerMemoryWorker(QUEUE_NAMES.WEBHOOK, async (data) => {
    try {
      await processWebhookDelivery(data as WebhookJobData);
    } catch (error) {
      logger.error('Memory queue webhook failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  if (!isQueueEnabled() || !connection) {
    logger.info('Webhook worker started', { backend: 'memory' });
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

  worker.on('completed', (job) => {
    logger.info('Webhook delivered', { deliveryId: job.data.deliveryId });
  });

  worker.on('failed', (job, err) => {
    logger.error('Webhook delivery failed', { 
      deliveryId: job?.data?.deliveryId, 
      error: err.message 
    });
  });

  worker.on('error', (err) => {
    logger.error('Webhook worker error', { error: err.message });
  });

  logger.info('Webhook worker started', { backend: 'redis' });
};

/**
 * Stop the webhook worker
 */
export const stopWebhookWorker = async (): Promise<void> => {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('Webhook worker stopped');
  }
};

export default {
  start: startWebhookWorker,
  stop: stopWebhookWorker,
};
