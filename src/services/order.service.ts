/**
 * Order Service
 * Business logic for order operations
 */

import { db } from '../db';
import { 
  orders, orderItems, orderRefunds, orderShippingLines, orderTaxLines, orderFeeLines, orderCouponLines,
  type Order, type NewOrder, type OrderItem, type NewOrderItem, 
  type OrderRefund, type NewOrderRefund,
  type OrderShippingLine, type NewOrderShippingLine,
  type OrderTaxLine, type NewOrderTaxLine,
  type OrderFeeLine, type NewOrderFeeLine,
  type OrderCouponLine, type NewOrderCouponLine,
} from '../db/schema/orders';
import { products } from '../db/schema/products';
import { eq, and, desc, asc, sql, like, inArray } from 'drizzle-orm';
import type { PaginationResult } from '../lib/pagination';
import { createPaginationResult } from '../lib/pagination';
import type { 
  CreateOrderInput, UpdateOrderInput, OrderListQuery, 
  CreateRefundInput, LineItemInput, ShippingLineInput 
} from '../validators/order.validators';
import { queueOrderProcessing, isQueueEnabled } from '../queue';

// Generate order number
const generateOrderNumber = (): string => {
  return String(Date.now()).slice(-8);
};

// Generate order key
const generateOrderKey = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'wc_order_';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * List orders with pagination
 */
export const listOrders = async (
  params: OrderListQuery
): Promise<PaginationResult<Order>> => {
  const { page, per_page, order, orderby, search, status, customer, include, exclude } = params;
  
  const offset = (page - 1) * per_page;
  const conditions = [eq(orders.isDeleted, false)];
  
  if (status && status.length > 0) {
    conditions.push(inArray(orders.status, status));
  }
  
  if (customer) {
    conditions.push(eq(orders.customerId, customer));
  }
  
  if (search) {
    conditions.push(like(orders.number, `%${search}%`));
  }
  
  if (include && include.length > 0) {
    conditions.push(inArray(orders.id, include));
  }
  
  if (exclude && exclude.length > 0) {
    conditions.push(sql`${orders.id} NOT IN ${exclude}`);
  }
  
  const orderColumn = orderby === 'id' ? orders.id : orders.dateCreated;
  const orderFn = order === 'asc' ? asc : desc;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(...conditions));
  
  const total = Number(count);
  
  const items = await db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(per_page)
    .offset(offset);
  
  return createPaginationResult(items, total, page, per_page);
};

/**
 * Get a single order by ID
 */
export const getOrder = async (id: number): Promise<Order | null> => {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.isDeleted, false)))
    .limit(1);
  
  return order ?? null;
};

/**
 * Get order line items
 */
export const getOrderItems = async (orderId: number): Promise<OrderItem[]> => {
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
};

/**
 * Get order shipping lines
 */
export const getOrderShippingLines = async (orderId: number): Promise<OrderShippingLine[]> => {
  return db.select().from(orderShippingLines).where(eq(orderShippingLines.orderId, orderId));
};

/**
 * Get order tax lines
 */
export const getOrderTaxLines = async (orderId: number): Promise<OrderTaxLine[]> => {
  return db.select().from(orderTaxLines).where(eq(orderTaxLines.orderId, orderId));
};

/**
 * Get order fee lines
 */
export const getOrderFeeLines = async (orderId: number): Promise<OrderFeeLine[]> => {
  return db.select().from(orderFeeLines).where(eq(orderFeeLines.orderId, orderId));
};

/**
 * Get order coupon lines
 */
export const getOrderCouponLines = async (orderId: number): Promise<OrderCouponLine[]> => {
  return db.select().from(orderCouponLines).where(eq(orderCouponLines.orderId, orderId));
};

/**
 * Get order refunds
 */
export const getOrderRefunds = async (orderId: number): Promise<OrderRefund[]> => {
  return db.select().from(orderRefunds).where(eq(orderRefunds.orderId, orderId));
};

/**
 * Process line items for an order
 */
const processLineItems = async (orderId: number, lineItems: LineItemInput[]): Promise<OrderItem[]> => {
  const items: OrderItem[] = [];
  
  for (const item of lineItems) {
    // Get product info
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, item.product_id))
      .limit(1);
    
    const newItem: NewOrderItem = {
      orderId,
      name: item.name ?? product?.name ?? 'Unknown Product',
      productId: item.product_id,
      variationId: item.variation_id ?? 0,
      quantity: item.quantity ?? 1,
      taxClass: item.tax_class ?? '',
      subtotal: item.subtotal ?? '0.00',
      subtotalTax: item.subtotal_tax ?? '0.00',
      total: item.total ?? '0.00',
      totalTax: item.total_tax ?? '0.00',
      sku: item.sku ?? product?.sku ?? null,
      price: item.price?.toString() ?? product?.price ?? null,
      taxes: item.taxes ?? [],
      metaData: item.meta_data ?? [],
    };
    
    const [created] = await db.insert(orderItems).values(newItem).returning();
    items.push(created);
    
    // Note: Inventory reduction is now handled by the order worker queue
  }
  
  return items;
};

/**
 * Process shipping lines for an order
 */
const processShippingLines = async (orderId: number, shippingLines: ShippingLineInput[]): Promise<OrderShippingLine[]> => {
  const lines: OrderShippingLine[] = [];
  
  for (const line of shippingLines) {
    const newLine: NewOrderShippingLine = {
      orderId,
      methodTitle: line.method_title,
      methodId: line.method_id,
      total: line.total ?? '0.00',
      totalTax: line.total_tax ?? '0.00',
      taxes: line.taxes ?? [],
      metaData: line.meta_data ?? [],
    };
    
    const [created] = await db.insert(orderShippingLines).values(newLine).returning();
    lines.push(created);
  }
  
  return lines;
};

/**
 * Calculate order totals
 */
const calculateOrderTotals = async (orderId: number): Promise<void> => {
  // Get line items total
  const [itemTotal] = await db
    .select({ total: sql<string>`COALESCE(SUM(total::numeric), 0)` })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  
  // Get shipping total
  const [shippingTotal] = await db
    .select({ total: sql<string>`COALESCE(SUM(total::numeric), 0)` })
    .from(orderShippingLines)
    .where(eq(orderShippingLines.orderId, orderId));
  
  // Get fee total
  const [feeTotal] = await db
    .select({ total: sql<string>`COALESCE(SUM(total::numeric), 0)` })
    .from(orderFeeLines)
    .where(eq(orderFeeLines.orderId, orderId));
  
  // Get discount total
  const [discountTotal] = await db
    .select({ total: sql<string>`COALESCE(SUM(discount::numeric), 0)` })
    .from(orderCouponLines)
    .where(eq(orderCouponLines.orderId, orderId));
  
  const itemsTotal = parseFloat(itemTotal?.total ?? '0');
  const shipping = parseFloat(shippingTotal?.total ?? '0');
  const fees = parseFloat(feeTotal?.total ?? '0');
  const discount = parseFloat(discountTotal?.total ?? '0');
  const grandTotal = itemsTotal + shipping + fees - discount;
  
  await db
    .update(orders)
    .set({
      total: grandTotal.toFixed(2),
      shippingTotal: shipping.toFixed(2),
      discountTotal: discount.toFixed(2),
    })
    .where(eq(orders.id, orderId));
};

/**
 * Create a new order
 */
export const createOrder = async (input: CreateOrderInput): Promise<Order> => {
  const now = new Date();
  
  const newOrder: NewOrder = {
    number: generateOrderNumber(),
    orderKey: generateOrderKey(),
    parentId: input.parent_id ?? 0,
    status: input.status ?? 'pending',
    currency: input.currency ?? 'USD',
    createdVia: 'rest-api',
    version: '3.0.0',
    customerId: input.customer_id ?? 0,
    customerIpAddress: null,
    customerUserAgent: null,
    customerNote: input.customer_note ?? null,
    billing: input.billing ?? {},
    shipping: input.shipping ?? {},
    paymentMethod: input.payment_method ?? null,
    paymentMethodTitle: input.payment_method_title ?? null,
    transactionId: input.transaction_id ?? null,
    discountTotal: '0.00',
    discountTax: '0.00',
    shippingTotal: '0.00',
    shippingTax: '0.00',
    cartTax: '0.00',
    total: '0.00',
    totalTax: '0.00',
    pricesIncludeTax: false,
    cartHash: null,
    metaData: input.meta_data ?? [],
    dateCreated: now,
    dateCreatedGmt: now,
    dateModified: now,
    dateModifiedGmt: now,
    datePaid: input.set_paid ? now : null,
    datePaidGmt: input.set_paid ? now : null,
    dateCompleted: null,
    dateCompletedGmt: null,
    isDeleted: false,
  };
  
  const [order] = await db.insert(orders).values(newOrder).returning();
  
  // Process line items
  if (input.line_items && input.line_items.length > 0) {
    await processLineItems(order.id, input.line_items);
  }
  
  // Process shipping lines
  if (input.shipping_lines && input.shipping_lines.length > 0) {
    await processShippingLines(order.id, input.shipping_lines);
  }
  
  // Process fee lines
  if (input.fee_lines && input.fee_lines.length > 0) {
    for (const fee of input.fee_lines) {
      await db.insert(orderFeeLines).values({
        orderId: order.id,
        name: fee.name,
        taxClass: fee.tax_class ?? '',
        taxStatus: fee.tax_status ?? 'taxable',
        total: fee.total ?? '0.00',
        totalTax: fee.total_tax ?? '0.00',
        taxes: fee.taxes ?? [],
        metaData: fee.meta_data ?? [],
      });
    }
  }
  
  // Process coupon lines
  if (input.coupon_lines && input.coupon_lines.length > 0) {
    for (const coupon of input.coupon_lines) {
      await db.insert(orderCouponLines).values({
        orderId: order.id,
        code: coupon.code,
        discount: coupon.discount ?? '0.00',
        discountTax: coupon.discount_tax ?? '0.00',
        metaData: coupon.meta_data ?? [],
      });
    }
  }
  
  // Calculate totals
  await calculateOrderTotals(order.id);
  
  // Refetch order with updated totals
  const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
  const finalOrder = updatedOrder ?? order;
  
  // Queue order processing (inventory, webhooks, emails)
  if (isQueueEnabled()) {
    await queueOrderProcessing(finalOrder.id, 'created');
  }
  
  return finalOrder;
};

/**
 * Update an order
 */
export const updateOrder = async (
  id: number,
  input: UpdateOrderInput
): Promise<Order | null> => {
  const existing = await getOrder(id);
  if (!existing) return null;
  
  const oldStatus = existing.status;
  
  const updateData: Partial<NewOrder> = {
    dateModified: new Date(),
    dateModifiedGmt: new Date(),
  };
  
  if (input.status !== undefined) {
    updateData.status = input.status;
    if (input.status === 'completed') {
      updateData.dateCompleted = new Date();
      updateData.dateCompletedGmt = new Date();
    }
  }
  
  if (input.billing !== undefined) updateData.billing = input.billing;
  if (input.shipping !== undefined) updateData.shipping = input.shipping;
  if (input.payment_method !== undefined) updateData.paymentMethod = input.payment_method;
  if (input.payment_method_title !== undefined) updateData.paymentMethodTitle = input.payment_method_title;
  if (input.transaction_id !== undefined) updateData.transactionId = input.transaction_id;
  if (input.customer_note !== undefined) updateData.customerNote = input.customer_note;
  if (input.meta_data !== undefined) updateData.metaData = input.meta_data;
  
  if (input.set_paid === true) {
    updateData.datePaid = new Date();
    updateData.datePaidGmt = new Date();
    if (existing.status === 'pending' || existing.status === 'on-hold') {
      updateData.status = 'processing';
    }
  }
  
  const [order] = await db
    .update(orders)
    .set(updateData)
    .where(and(eq(orders.id, id), eq(orders.isDeleted, false)))
    .returning();
  
  // Update line items if provided
  if (input.line_items !== undefined) {
    // Delete existing items
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    // Add new items
    if (input.line_items.length > 0) {
      await processLineItems(id, input.line_items);
    }
    await calculateOrderTotals(id);
  }
  
  // Queue order processing if status changed
  if (order && input.status !== undefined && oldStatus !== input.status) {
    if (isQueueEnabled()) {
      await queueOrderProcessing(order.id, 'status_changed', oldStatus, input.status);
    }
  }
  
  return order ?? null;
};

/**
 * Delete an order (soft delete)
 */
export const deleteOrder = async (id: number, force = false): Promise<Order | null> => {
  const existing = await getOrder(id);
  if (!existing) return null;
  
  if (force) {
    // Delete related records first
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    await db.delete(orderShippingLines).where(eq(orderShippingLines.orderId, id));
    await db.delete(orderTaxLines).where(eq(orderTaxLines.orderId, id));
    await db.delete(orderFeeLines).where(eq(orderFeeLines.orderId, id));
    await db.delete(orderCouponLines).where(eq(orderCouponLines.orderId, id));
    await db.delete(orderRefunds).where(eq(orderRefunds.orderId, id));
    await db.delete(orders).where(eq(orders.id, id));
    return existing;
  }
  
  const [order] = await db
    .update(orders)
    .set({ isDeleted: true, status: 'trash', dateModified: new Date(), dateModifiedGmt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  
  // Queue cancelled event (restore inventory, etc.)
  if (order && isQueueEnabled()) {
    await queueOrderProcessing(order.id, 'cancelled', existing.status, 'trash');
  }
  
  return order ?? null;
};

// ========== REFUNDS ==========

/**
 * Get a single refund
 */
export const getRefund = async (orderId: number, refundId: number): Promise<OrderRefund | null> => {
  const [refund] = await db
    .select()
    .from(orderRefunds)
    .where(and(eq(orderRefunds.id, refundId), eq(orderRefunds.orderId, orderId)))
    .limit(1);
  
  return refund ?? null;
};

/**
 * Create a refund
 */
export const createRefund = async (
  orderId: number,
  input: CreateRefundInput
): Promise<OrderRefund> => {
  const now = new Date();
  
  const newRefund: NewOrderRefund = {
    orderId,
    amount: input.amount,
    reason: input.reason ?? null,
    dateCreated: now,
    dateCreatedGmt: now,
    metaData: input.meta_data ?? [],
  };
  
  const [refund] = await db.insert(orderRefunds).values(newRefund).returning();
  
  // Update order status to refunded if full refund
  const order = await getOrder(orderId);
  if (order) {
    const refundTotal = parseFloat(input.amount);
    const orderTotal = parseFloat(order.total);
    
    if (refundTotal >= orderTotal) {
      await db
        .update(orders)
        .set({ status: 'refunded', dateModified: new Date(), dateModifiedGmt: new Date() })
        .where(eq(orders.id, orderId));
      
      // Queue refunded event (restore inventory, etc.)
      if (isQueueEnabled()) {
        await queueOrderProcessing(orderId, 'refunded', order.status, 'refunded');
      }
    }
  }
  
  return refund;
};

/**
 * Delete a refund
 */
export const deleteRefund = async (orderId: number, refundId: number): Promise<OrderRefund | null> => {
  const existing = await getRefund(orderId, refundId);
  if (!existing) return null;
  
  await db.delete(orderRefunds).where(eq(orderRefunds.id, refundId));
  
  return existing;
};

// ========== BATCH OPERATIONS ==========

export const batchCreateOrders = async (inputs: CreateOrderInput[]): Promise<Order[]> => {
  const results: Order[] = [];
  for (const input of inputs) {
    const order = await createOrder(input);
    results.push(order);
  }
  return results;
};

export const batchUpdateOrders = async (
  updates: Array<{ id: number } & UpdateOrderInput>
): Promise<(Order | null)[]> => {
  const results: (Order | null)[] = [];
  for (const update of updates) {
    const order = await updateOrder(update.id, update);
    results.push(order);
  }
  return results;
};

export const batchDeleteOrders = async (ids: number[], force = false): Promise<(Order | null)[]> => {
  const results: (Order | null)[] = [];
  for (const id of ids) {
    const order = await deleteOrder(id, force);
    results.push(order);
  }
  return results;
};

// Service export
export const orderService = {
  list: listOrders,
  get: getOrder,
  create: createOrder,
  update: updateOrder,
  delete: deleteOrder,
  // Line items
  getItems: getOrderItems,
  getShippingLines: getOrderShippingLines,
  getTaxLines: getOrderTaxLines,
  getFeeLines: getOrderFeeLines,
  getCouponLines: getOrderCouponLines,
  getRefunds: getOrderRefunds,
  // Refunds
  getRefund,
  createRefund,
  deleteRefund,
  // Batch
  batchCreate: batchCreateOrders,
  batchUpdate: batchUpdateOrders,
  batchDelete: batchDeleteOrders,
};

export default orderService;
