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
      
      console.log(`   📦 Reduced stock for product ${item.productId} by ${item.quantity}`);
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
      
      console.log(`   📦 Restored stock for product ${item.productId} by ${item.quantity}`);
    }
  }
};

/**
 * Increment coupon usage
 */
const incrementCouponUsage = async (orderId: number): Promise<void> => {
  // Get coupon lines from the separate table
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
    
    console.log(`   🎟️  Incremented coupon usage: ${couponLine.code}`);
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

  // Update customer's total spent
  await db
    .update(customers)
    .set({
      isPayingCustomer: true,
      dateModified: new Date(),
    })
    .where(eq(customers.id, order.customerId));
  
  console.log(`   👤 Updated customer ${order.customerId} as paying customer`);
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
  
  console.log(`   🪝 Dispatched webhook: order.${event}`);
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
    console.log(`   ⚠️  No email for order ${orderId}`);
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
  
  console.log(`   📧 Queued email: ${type}`);
};

/**
 * Process order job
 */
const processOrder = async (data: OrderJobData): Promise<void> => {
  const { orderId, type, oldStatus, newStatus } = data;
  
  console.log(`📦 Processing order ${orderId}: ${type}`);

  switch (type) {
    case 'created':
      // New order - reduce inventory
      await reduceInventory(orderId);
      await incrementCouponUsage(orderId);
      await updateCustomerStats(orderId);
      await dispatchOrderWebhook(orderId, 'created');
      await queueOrderEmail(orderId, 'created');
      break;

    case 'status_changed':
      // Status changed - handle based on new status
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
  // Always register handler for memory queue fallback
  registerMemoryWorker(QUEUE_NAMES.ORDER, async (data) => {
    try {
      await processOrder(data as OrderJobData);
    } catch (error) {
      console.error('Memory queue order processing failed:', error);
    }
  });

  if (!isQueueEnabled() || !connection) {
    console.log('📦 Order worker using in-memory queue');
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

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`✅ Order processed: ${job.data.orderId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Order processing failed: ${job?.data?.orderId}`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Order worker error:', err);
  });

  console.log('🔄 Order worker started (Redis)');
};

/**
 * Stop the order worker
 */
export const stopOrderWorker = async (): Promise<void> => {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('Order worker stopped');
  }
};

export default {
  start: startOrderWorker,
  stop: stopOrderWorker,
};
