/**
 * Order Processing Worker
 * Handles order-related background tasks:
 * - Inventory management (reduce/restore stock)
 * - Coupon usage tracking
 * - Customer order count updates
 * - Webhook dispatch
 * - Email notifications
 */

import { Worker, Job } from 'bullmq';
import { 
  connection, 
  QUEUE_NAMES, 
  isQueueEnabled,
  registerMemoryWorker,
  queueWebhookDelivery,
  queueEmail,
} from '../index';
import { db } from '../../db';
import { orders, orderItems, orderCouponLines } from '../../db/schema/orders';
import { products } from '../../db/schema/products';
import { coupons } from '../../db/schema/coupons';
import { customers } from '../../db/schema/customers';
import { eq, and, sql } from 'drizzle-orm';
import { dispatchWebhook } from '../../webhooks/dispatcher';
import logger from '../../lib/logger';

interface OrderJobData {
  orderId: number;
  type: 'created' | 'updated' | 'status_changed' | 'cancelled' | 'refunded';
  oldStatus?: string;
  newStatus?: string;
}

let worker: Worker<OrderJobData> | null = null;

/**
 * Reduce inventory for an order
 */
const reduceInventory = async (orderId: number): Promise<void> => {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    if (item.productId) {
      await db
        .update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`,
          totalSales: sql`${products.totalSales} + ${item.quantity}`,
          dateModified: new Date(),
        })
        .where(eq(products.id, item.productId));
      
      logger.debug('Stock reduced', { orderId, productId: item.productId, quantity: item.quantity });
    }
  }
};

/**
 * Restore inventory for an order
 */
const restoreInventory = async (orderId: number): Promise<void> => {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    if (item.productId) {
      await db
        .update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
          totalSales: sql`${products.totalSales} - ${item.quantity}`,
          dateModified: new Date(),
        })
        .where(eq(products.id, item.productId));
      
      logger.debug('Stock restored', { orderId, productId: item.productId, quantity: item.quantity });
    }
  }
};

/**
 * Increment coupon usage
 */
const incrementCouponUsage = async (orderId: number): Promise<void> => {
  const couponLines = await db
    .select()
    .from(orderCouponLines)
    .where(eq(orderCouponLines.orderId, orderId));

  if (couponLines.length === 0) return;
  
  for (const couponLine of couponLines) {
    await db
      .update(coupons)
      .set({
        usageCount: sql`${coupons.usageCount} + 1`,
        dateModified: new Date(),
      })
      .where(eq(coupons.code, couponLine.code));
    
    logger.debug('Coupon usage incremented', { orderId, couponCode: couponLine.code });
  }
};

/**
 * Update customer order count and total spent
 */
const updateCustomerStats = async (orderId: number): Promise<void> => {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || !order.customerId) return;

  await db
    .update(customers)
    .set({
      isPayingCustomer: true,
      dateModified: new Date(),
    })
    .where(eq(customers.id, order.customerId));
  
  logger.debug('Customer stats updated', { orderId, customerId: order.customerId });
};

/**
 * Dispatch order webhook
 */
const dispatchOrderWebhook = async (
  orderId: number,
  event: string
): Promise<void> => {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  await dispatchWebhook({
    topic: `order.${event}`,
    resource: 'order',
    event,
    data: order,
  });
  
  logger.debug('Webhook dispatched', { orderId, event: `order.${event}` });
};

/**
 * Queue order emails
 */
const queueOrderEmail = async (
  orderId: number,
  type: string
): Promise<void> => {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  const [customer] = order.customerId 
    ? await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
    : [null];

  const billing = order.billing as { email?: string } | null;
  const email = customer?.email ?? billing?.email;
  
  if (!email) {
    logger.warn('No email for order notification', { orderId });
    return;
  }

  const emailTypes: Record<string, { subject: string }> = {
    created: { subject: `Order #${order.id} Received` },
    completed: { subject: `Order #${order.id} Completed` },
    cancelled: { subject: `Order #${order.id} Cancelled` },
    refunded: { subject: `Order #${order.id} Refunded` },
    'on-hold': { subject: `Order #${order.id} On Hold` },
    processing: { subject: `Order #${order.id} Processing` },
  };

  const emailConfig = emailTypes[type] ?? emailTypes.created;

  await queueEmail('order_notification', {
    to: email,
    subject: emailConfig.subject,
    template: `order-${type}`,
    data: { orderId, order },
  });
  
  logger.debug('Email queued', { orderId, type, to: email });
};

/**
 * Process order job
 */
const processOrder = async (data: OrderJobData): Promise<void> => {
  const { orderId, type, newStatus } = data;
  
  logger.info('Processing order', { orderId, type, newStatus });

  switch (type) {
    case 'created':
      await reduceInventory(orderId);
      await incrementCouponUsage(orderId);
      await updateCustomerStats(orderId);
      await dispatchOrderWebhook(orderId, 'created');
      await queueOrderEmail(orderId, 'created');
      break;

    case 'status_changed':
      if (newStatus === 'completed') {
        await dispatchOrderWebhook(orderId, 'updated');
        await queueOrderEmail(orderId, 'completed');
      } else if (newStatus === 'cancelled') {
        await restoreInventory(orderId);
        await dispatchOrderWebhook(orderId, 'updated');
        await queueOrderEmail(orderId, 'cancelled');
      } else if (newStatus === 'refunded') {
        await restoreInventory(orderId);
        await dispatchOrderWebhook(orderId, 'updated');
        await queueOrderEmail(orderId, 'refunded');
      } else if (newStatus === 'processing') {
        await dispatchOrderWebhook(orderId, 'updated');
        await queueOrderEmail(orderId, 'processing');
      } else if (newStatus === 'on-hold') {
        await queueOrderEmail(orderId, 'on-hold');
      }
      break;

    case 'cancelled':
      await restoreInventory(orderId);
      await dispatchOrderWebhook(orderId, 'updated');
      await queueOrderEmail(orderId, 'cancelled');
      break;

    case 'refunded':
      await restoreInventory(orderId);
      await dispatchOrderWebhook(orderId, 'updated');
      await queueOrderEmail(orderId, 'refunded');
      break;

    case 'updated':
      await dispatchOrderWebhook(orderId, 'updated');
      break;
  }
};

/**
 * Start the order worker
 */
export const startOrderWorker = (): void => {
  registerMemoryWorker(QUEUE_NAMES.ORDER, async (data) => {
    try {
      await processOrder(data as OrderJobData);
    } catch (error) {
      logger.error('Memory queue order processing failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  if (!isQueueEnabled() || !connection) {
    logger.info('Order worker started', { backend: 'memory' });
    return;
  }

  worker = new Worker<OrderJobData>(
    QUEUE_NAMES.ORDER,
    async (job: Job<OrderJobData>) => {
      await processOrder(job.data);
      return { success: true, orderId: job.data.orderId };
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    logger.info('Order processed', { orderId: job.data.orderId });
  });

  worker.on('failed', (job, err) => {
    logger.error('Order processing failed', { 
      orderId: job?.data?.orderId, 
      error: err.message 
    });
  });

  worker.on('error', (err) => {
    logger.error('Order worker error', { error: err.message });
  });

  logger.info('Order worker started', { backend: 'redis' });
};

/**
 * Stop the order worker
 */
export const stopOrderWorker = async (): Promise<void> => {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('Order worker stopped');
  }
};

export default {
  start: startOrderWorker,
  stop: stopOrderWorker,
};
