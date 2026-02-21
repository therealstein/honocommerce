/**
 * BullMQ Queue Setup
 * Redis-based job queue for async processing
 * 
 * REQUIRED: Redis connection (REDIS_URL env var)
 * Falls back to in-memory queue if Redis is unavailable
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Check if Redis URL is configured
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// State
let connection: IORedis | null = null;
let isRedisConnected = false;

// In-memory fallback queue
const memoryQueues: Map<string, Array<{ data: Record<string, unknown>; handler: (data: Record<string, unknown>) => Promise<void> }>> = new Map();
const memoryWorkers: Map<string, (data: Record<string, unknown>) => Promise<void>> = new Map();
let memoryQueueInterval: Timer | null = null;

// Queue names
export const QUEUE_NAMES = {
  WEBHOOK: 'webhook-delivery',
  EMAIL: 'email',
  ORDER: 'order-processing',
} as const;

// Queues
let webhookQueue: Queue | null = null;
let emailQueue: Queue | null = null;
let orderQueue: Queue | null = null;

// Queue Events
let webhookQueueEvents: QueueEvents | null = null;
let emailQueueEvents: QueueEvents | null = null;
let orderQueueEvents: QueueEvents | null = null;

/**
 * Initialize in-memory queue fallback
 */
const initializeMemoryQueue = (): void => {
  console.log('📦 In-memory queue initialized (no persistence)');
  
  // Initialize memory queues
  Object.values(QUEUE_NAMES).forEach(name => {
    memoryQueues.set(name, []);
  });

  // Start processing loop
  memoryQueueInterval = setInterval(async () => {
    for (const [queueName, jobs] of memoryQueues) {
      while (jobs.length > 0) {
        const job = jobs.shift();
        if (job) {
          try {
            await job.handler(job.data);
          } catch (error) {
            console.error(`Memory queue job failed [${queueName}]:`, error);
          }
        }
      }
    }
  }, 100); // Process every 100ms
};

/**
 * Add job to memory queue
 */
const addToMemoryQueue = async (
  queueName: string,
  data: Record<string, unknown>
): Promise<void> => {
  const handler = memoryWorkers.get(queueName);
  let queue = memoryQueues.get(queueName);
  
  if (!handler) {
    console.warn(`No worker registered for queue: ${queueName}`);
    return;
  }
  
  if (!queue) {
    queue = [];
    memoryQueues.set(queueName, queue);
  }
  
  queue.push({ data, handler });
};

/**
 * Register a worker for memory queue
 */
export const registerMemoryWorker = (
  queueName: string,
  handler: (data: Record<string, unknown>) => Promise<void>
): void => {
  memoryWorkers.set(queueName, handler);
};

/**
 * Check if queue system is using Redis
 */
export const isQueueEnabled = (): boolean => isRedisConnected;

/**
 * Get queue stats
 */
export const getQueueStats = async () => {
  if (isRedisConnected) {
    const [webhookWaiting, emailWaiting, orderWaiting] = await Promise.all([
      webhookQueue?.getWaitingCount() ?? 0,
      emailQueue?.getWaitingCount() ?? 0,
      orderQueue?.getWaitingCount() ?? 0,
    ]);

    return {
      enabled: true,
      backend: 'redis',
      queues: {
        webhook: { waiting: webhookWaiting },
        email: { waiting: emailWaiting },
        order: { waiting: orderWaiting },
      },
    };
  }

  return {
    enabled: true,
    backend: 'memory',
    queues: {
      webhook: { waiting: memoryQueues.get(QUEUE_NAMES.WEBHOOK)?.length ?? 0 },
      email: { waiting: memoryQueues.get(QUEUE_NAMES.EMAIL)?.length ?? 0 },
      order: { waiting: memoryQueues.get(QUEUE_NAMES.ORDER)?.length ?? 0 },
    },
  };
};

/**
 * Initialize queue system
 */
export const initializeQueues = async (): Promise<void> => {
  console.log(`🔄 Connecting to Redis at ${redisUrl}...`);
  
  try {
    // Create Redis connection
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true, // Don't connect immediately
    });

    // Try to connect
    await connection.connect();
    
    // Test connection with ping
    const pong = await connection.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    
    isRedisConnected = true;
    console.log('✅ Redis connected - Queue system using Redis');

    // Create queues
    webhookQueue = new Queue(QUEUE_NAMES.WEBHOOK, { connection });
    emailQueue = new Queue(QUEUE_NAMES.EMAIL, { connection });
    orderQueue = new Queue(QUEUE_NAMES.ORDER, { connection });

    // Queue events
    webhookQueueEvents = new QueueEvents(QUEUE_NAMES.WEBHOOK, { connection });
    emailQueueEvents = new QueueEvents(QUEUE_NAMES.EMAIL, { connection });
    orderQueueEvents = new QueueEvents(QUEUE_NAMES.ORDER, { connection });

    // Handle connection errors after initial connection
    connection.on('error', (err) => {
      console.error('Redis error:', err.message);
    });

    connection.on('close', () => {
      console.warn('Redis connection closed');
      isRedisConnected = false;
    });

  } catch (error) {
    const err = error as Error;
    console.warn(`⚠️  Redis unavailable: ${err.message}`);
    console.log('📦 Falling back to in-memory queue');
    
    // Clean up failed connection
    if (connection) {
      try {
        connection.disconnect(false);
      } catch (e) {
        // Ignore disconnect errors
      }
      connection = null;
    }
    
    isRedisConnected = false;
    initializeMemoryQueue();
  }
};

/**
 * Add a webhook delivery job to the queue
 */
export const queueWebhookDelivery = async (
  deliveryId: string,
  webhookId: number,
  payload: Record<string, unknown>
): Promise<void> => {
  const data = { deliveryId, webhookId, payload };

  if (isRedisConnected && webhookQueue) {
    await webhookQueue.add('deliver', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  } else {
    await addToMemoryQueue(QUEUE_NAMES.WEBHOOK, data);
  }
};

/**
 * Add an email job to the queue
 */
export const queueEmail = async (
  type: string,
  data: Record<string, unknown>
): Promise<void> => {
  const jobData = { type, ...data };

  if (isRedisConnected && emailQueue) {
    await emailQueue.add(type, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  } else {
    await addToMemoryQueue(QUEUE_NAMES.EMAIL, jobData);
  }
};

/**
 * Add an order processing job to the queue
 */
export const queueOrderProcessing = async (
  orderId: number,
  type: 'created' | 'updated' | 'status_changed' | 'cancelled' | 'refunded',
  oldStatus?: string,
  newStatus?: string
): Promise<void> => {
  const data = { orderId, type, oldStatus, newStatus };

  if (isRedisConnected && orderQueue) {
    await orderQueue.add(type, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  } else {
    await addToMemoryQueue(QUEUE_NAMES.ORDER, data);
  }
};

/**
 * Graceful shutdown
 */
export const shutdownQueues = async (): Promise<void> => {
  console.log('Shutting down queues...');

  // Stop memory queue interval
  if (memoryQueueInterval) {
    clearInterval(memoryQueueInterval);
    memoryQueueInterval = null;
  }

  if (isRedisConnected && connection) {
    await Promise.all([
      webhookQueue?.close(),
      emailQueue?.close(),
      orderQueue?.close(),
      webhookQueueEvents?.close(),
      emailQueueEvents?.close(),
      orderQueueEvents?.close(),
    ]);
    
    await connection.quit();
  }

  console.log('Queues shut down complete');
};

export {
  connection,
  webhookQueue,
  emailQueue,
  orderQueue,
  webhookQueueEvents,
  emailQueueEvents,
  orderQueueEvents,
};

export default {
  initialize: initializeQueues,
  isQueueEnabled,
  getQueueStats,
  queueWebhookDelivery,
  queueEmail,
  queueOrderProcessing,
  registerMemoryWorker,
  shutdownQueues,
};
