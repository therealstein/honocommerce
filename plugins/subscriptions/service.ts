/**
 * Subscription Service
 * Business logic for subscription operations
 * Uses raw SQL for plugin-managed tables
 */

import { db } from '../../src/db';
import { sql } from 'drizzle-orm';
import type { PaginationResult } from '../../src/lib/pagination';
import { createPaginationResult } from '../../src/lib/pagination';
import type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  SubscriptionListQuery,
  LineItemInput,
  ShippingLineInput,
  CreateSubscriptionNoteInput,
  SubscriptionNoteListQuery,
} from './validators';
import type { Subscription, SubscriptionNote } from './types';

// Generate subscription number
const generateSubscriptionNumber = (): string => {
  return String(Date.now()).slice(-8);
};

// Generate order key (subscriptions share order key format)
const generateOrderKey = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'wc_subscription_';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * List subscriptions with pagination
 */
export const listSubscriptions = async (
  params: SubscriptionListQuery
): Promise<PaginationResult<Subscription>> => {
  const { page, per_page, order, orderby, search, status, customer, include, exclude } = params;

  const offset = (page - 1) * per_page;
  const conditions: string[] = ['is_deleted = false'];

  if (status && status.length > 0) {
    const statusList = status.map(s => `'${s}'`).join(', ');
    conditions.push(`status IN (${statusList})`);
  }

  if (customer) {
    conditions.push(`customer_id = ${customer}`);
  }

  if (search) {
    conditions.push(`number LIKE '%${search}%'`);
  }

  if (include && include.length > 0) {
    conditions.push(`id IN (${include.join(', ')})`);
  }

  if (exclude && exclude.length > 0) {
    conditions.push(`id NOT IN (${exclude.join(', ')})`);
  }

  const whereClause = conditions.join(' AND ');
  const orderColumn = orderby === 'id' ? 'id' : 'date_created';
  const orderDir = order === 'asc' ? 'ASC' : 'DESC';

  // Get total count
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM subscriptions WHERE ${sql.raw(whereClause)}
  `);
  const total = Number(countResult[0]?.count ?? 0);

  // Get items
  const itemsResult = await db.execute(sql`
    SELECT * FROM subscriptions 
    WHERE ${sql.raw(whereClause)}
    ORDER BY ${sql.raw(orderColumn)} ${sql.raw(orderDir)}
    LIMIT ${per_page} OFFSET ${offset}
  `);

  const items = itemsResult.rows as unknown as Subscription[];

  return createPaginationResult(items, total, page, per_page);
};

/**
 * Get a single subscription by ID
 */
export const getSubscription = async (id: number): Promise<Subscription | null> => {
  const result = await db.execute(sql`
    SELECT * FROM subscriptions WHERE id = ${id} AND is_deleted = false LIMIT 1
  `);

  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as Subscription;
};

/**
 * Get subscription line items
 */
export const getSubscriptionItems = async (subscriptionId: number): Promise<unknown[]> => {
  const result = await db.execute(sql`
    SELECT * FROM subscription_items WHERE subscription_id = ${subscriptionId}
  `);
  return result.rows;
};

/**
 * Get subscription shipping lines
 */
export const getSubscriptionShippingLines = async (subscriptionId: number): Promise<unknown[]> => {
  const result = await db.execute(sql`
    SELECT * FROM subscription_shipping_lines WHERE subscription_id = ${subscriptionId}
  `);
  return result.rows;
};

/**
 * Get subscription tax lines
 */
export const getSubscriptionTaxLines = async (subscriptionId: number): Promise<unknown[]> => {
  const result = await db.execute(sql`
    SELECT * FROM subscription_tax_lines WHERE subscription_id = ${subscriptionId}
  `);
  return result.rows;
};

/**
 * Get subscription fee lines
 */
export const getSubscriptionFeeLines = async (subscriptionId: number): Promise<unknown[]> => {
  const result = await db.execute(sql`
    SELECT * FROM subscription_fee_lines WHERE subscription_id = ${subscriptionId}
  `);
  return result.rows;
};

/**
 * Get subscription coupon lines
 */
export const getSubscriptionCouponLines = async (subscriptionId: number): Promise<unknown[]> => {
  const result = await db.execute(sql`
    SELECT * FROM subscription_coupon_lines WHERE subscription_id = ${subscriptionId}
  `);
  return result.rows;
};

/**
 * Process line items for a subscription
 */
const processLineItems = async (subscriptionId: number, lineItems: LineItemInput[]): Promise<void> => {
  for (const item of lineItems) {
    // Get product info
    const productResult = await db.execute(sql`
      SELECT name, price, sku FROM products WHERE id = ${item.product_id} LIMIT 1
    `);
    const product = productResult.rows[0] as { name: string; price: string; sku: string } | undefined;

    const quantity = item.quantity ?? 1;
    const productPrice = product?.price ? parseFloat(product.price) : 0;

    // Calculate subtotal and total from product price if not provided
    const subtotal = item.subtotal ?? (productPrice * quantity).toFixed(2);
    const total = item.total ?? (productPrice * quantity).toFixed(2);

    await db.execute(sql`
      INSERT INTO subscription_items (
        subscription_id, name, product_id, variation_id, quantity, tax_class,
        subtotal, subtotal_tax, total, total_tax, sku, price, taxes, meta_data
      ) VALUES (
        ${subscriptionId},
        ${item.name ?? product?.name ?? 'Unknown Product'},
        ${item.product_id},
        ${item.variation_id ?? 0},
        ${quantity},
        ${item.tax_class ?? ''},
        ${subtotal},
        ${item.subtotal_tax ?? '0.00'},
        ${total},
        ${item.total_tax ?? '0.00'},
        ${item.sku ?? product?.sku ?? null},
        ${item.price?.toString() ?? product?.price ?? null},
        ${JSON.stringify(item.taxes ?? [])}::jsonb,
        ${JSON.stringify(item.meta_data ?? [])}::jsonb
      )
    `);
  }
};

/**
 * Process shipping lines for a subscription
 */
const processShippingLines = async (subscriptionId: number, shippingLines: ShippingLineInput[]): Promise<void> => {
  for (const line of shippingLines) {
    await db.execute(sql`
      INSERT INTO subscription_shipping_lines (
        subscription_id, method_title, method_id, instance_id, total, total_tax, taxes, meta_data
      ) VALUES (
        ${subscriptionId},
        ${line.method_title},
        ${line.method_id},
        null,
        ${line.total ?? '0.00'},
        ${line.total_tax ?? '0.00'},
        ${JSON.stringify(line.taxes ?? [])}::jsonb,
        ${JSON.stringify(line.meta_data ?? [])}::jsonb
      )
    `);
  }
};

/**
 * Calculate subscription totals
 */
const calculateSubscriptionTotals = async (subscriptionId: number): Promise<void> => {
  // Get line items total
  const itemResult = await db.execute(sql`
    SELECT COALESCE(SUM(total::numeric), 0) as total FROM subscription_items WHERE subscription_id = ${subscriptionId}
  `);
  const itemsTotal = parseFloat((itemResult.rows[0] as { total: string })?.total ?? '0');

  // Get shipping total
  const shippingResult = await db.execute(sql`
    SELECT COALESCE(SUM(total::numeric), 0) as total FROM subscription_shipping_lines WHERE subscription_id = ${subscriptionId}
  `);
  const shipping = parseFloat((shippingResult.rows[0] as { total: string })?.total ?? '0');

  // Get fee total
  const feeResult = await db.execute(sql`
    SELECT COALESCE(SUM(total::numeric), 0) as total FROM subscription_fee_lines WHERE subscription_id = ${subscriptionId}
  `);
  const fees = parseFloat((feeResult.rows[0] as { total: string })?.total ?? '0');

  // Get discount total
  const discountResult = await db.execute(sql`
    SELECT COALESCE(SUM(discount::numeric), 0) as total FROM subscription_coupon_lines WHERE subscription_id = ${subscriptionId}
  `);
  const discount = parseFloat((discountResult.rows[0] as { total: string })?.total ?? '0');

  const grandTotal = itemsTotal + shipping + fees - discount;

  await db.execute(sql`
    UPDATE subscriptions SET
      total = ${grandTotal.toFixed(2)},
      shipping_total = ${shipping.toFixed(2)},
      discount_total = ${discount.toFixed(2)}
    WHERE id = ${subscriptionId}
  `);
};

/**
 * Create a new subscription
 */
export const createSubscription = async (input: CreateSubscriptionInput): Promise<Subscription> => {
  const now = new Date();

  const result = await db.execute(sql`
    INSERT INTO subscriptions (
      number, order_key, parent_id, status, currency, created_via, version,
      customer_id, customer_note, billing, shipping, payment_method, payment_method_title, transaction_id,
      billing_period, billing_interval, start_date_gmt, trial_end_date_gmt, next_payment_date_gmt,
      last_payment_date_gmt, cancelled_date_gmt, end_date_gmt, payment_retry_date_gmt,
      discount_total, discount_tax, shipping_total, shipping_tax, cart_tax, total, total_tax,
      prices_include_tax, meta_data, is_deleted, date_created, date_created_gmt, date_modified, date_modified_gmt
    ) VALUES (
      ${generateSubscriptionNumber()},
      ${generateOrderKey()},
      ${input.parent_id ?? 0},
      ${input.status ?? 'pending'},
      ${input.currency ?? 'USD'},
      'rest-api',
      '3.0.0',
      ${input.customer_id ?? 0},
      ${input.customer_note ?? null},
      ${JSON.stringify(input.billing ?? {})}::jsonb,
      ${JSON.stringify(input.shipping ?? {})}::jsonb,
      ${input.payment_method ?? null},
      ${input.payment_method_title ?? null},
      ${input.transaction_id ?? null},
      ${input.billing_period ?? 'month'},
      ${input.billing_interval ?? 1},
      ${input.start_date_gmt ? new Date(input.start_date_gmt) : now},
      ${input.trial_end_date_gmt ? new Date(input.trial_end_date_gmt) : null},
      ${input.next_payment_date_gmt ? new Date(input.next_payment_date_gmt) : null},
      ${input.last_payment_date_gmt ? new Date(input.last_payment_date_gmt) : null},
      ${input.cancelled_date_gmt ? new Date(input.cancelled_date_gmt) : null},
      ${input.end_date_gmt ? new Date(input.end_date_gmt) : null},
      ${input.payment_retry_date_gmt ? new Date(input.payment_retry_date_gmt) : null},
      '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00',
      false,
      ${JSON.stringify(input.meta_data ?? [])}::jsonb,
      false,
      ${now}, ${now}, ${now}, ${now}
    ) RETURNING *
  `);

  const subscription = result.rows[0] as unknown as Subscription;

  // Process line items
  if (input.line_items && input.line_items.length > 0) {
    await processLineItems(subscription.id, input.line_items);
  }

  // Process shipping lines
  if (input.shipping_lines && input.shipping_lines.length > 0) {
    await processShippingLines(subscription.id, input.shipping_lines);
  }

  // Process fee lines
  if (input.fee_lines && input.fee_lines.length > 0) {
    for (const fee of input.fee_lines) {
      await db.execute(sql`
        INSERT INTO subscription_fee_lines (
          subscription_id, name, tax_class, tax_status, total, total_tax, taxes, meta_data
        ) VALUES (
          ${subscription.id},
          ${fee.name},
          ${fee.tax_class ?? ''},
          ${fee.tax_status ?? 'taxable'},
          ${fee.total ?? '0.00'},
          ${fee.total_tax ?? '0.00'},
          ${JSON.stringify(fee.taxes ?? [])}::jsonb,
          ${JSON.stringify(fee.meta_data ?? [])}::jsonb
        )
      `);
    }
  }

  // Process coupon lines
  if (input.coupon_lines && input.coupon_lines.length > 0) {
    for (const coupon of input.coupon_lines) {
      await db.execute(sql`
        INSERT INTO subscription_coupon_lines (
          subscription_id, code, discount, discount_tax, meta_data
        ) VALUES (
          ${subscription.id},
          ${coupon.code},
          ${coupon.discount ?? '0.00'},
          ${coupon.discount_tax ?? '0.00'},
          ${JSON.stringify(coupon.meta_data ?? [])}::jsonb
        )
      `);
    }
  }

  // Calculate totals
  await calculateSubscriptionTotals(subscription.id);

  // Refetch subscription with updated totals
  const updatedResult = await db.execute(sql`
    SELECT * FROM subscriptions WHERE id = ${subscription.id} LIMIT 1
  `);

  return updatedResult.rows[0] as unknown as Subscription;
};

/**
 * Update a subscription
 */
export const updateSubscription = async (
  id: number,
  input: UpdateSubscriptionInput
): Promise<Subscription | null> => {
  const existing = await getSubscription(id);
  if (!existing) return null;

  const updateFields: string[] = [];
  const updateValues: unknown[] = [];
  let paramIndex = 1;

  const addField = (field: string, value: unknown) => {
    updateFields.push(`${field} = $${paramIndex}`);
    updateValues.push(value);
    paramIndex++;
  };

  addField('date_modified', new Date());
  addField('date_modified_gmt', new Date());

  if (input.status !== undefined) addField('status', input.status);
  if (input.billing !== undefined) addField('billing', JSON.stringify(input.billing));
  if (input.shipping !== undefined) addField('shipping', JSON.stringify(input.shipping));
  if (input.payment_method !== undefined) addField('payment_method', input.payment_method);
  if (input.payment_method_title !== undefined) addField('payment_method_title', input.payment_method_title);
  if (input.transaction_id !== undefined) addField('transaction_id', input.transaction_id);
  if (input.customer_note !== undefined) addField('customer_note', input.customer_note);
  if (input.meta_data !== undefined) addField('meta_data', JSON.stringify(input.meta_data));
  if (input.customer_id !== undefined) addField('customer_id', input.customer_id);
  if (input.billing_period !== undefined) addField('billing_period', input.billing_period);
  if (input.billing_interval !== undefined) addField('billing_interval', input.billing_interval);

  // Handle subscription dates
  if (input.start_date_gmt !== undefined) addField('start_date_gmt', input.start_date_gmt ? new Date(input.start_date_gmt) : null);
  if (input.trial_end_date_gmt !== undefined) addField('trial_end_date_gmt', input.trial_end_date_gmt ? new Date(input.trial_end_date_gmt) : null);
  if (input.next_payment_date_gmt !== undefined) addField('next_payment_date_gmt', input.next_payment_date_gmt ? new Date(input.next_payment_date_gmt) : null);
  if (input.last_payment_date_gmt !== undefined) addField('last_payment_date_gmt', input.last_payment_date_gmt ? new Date(input.last_payment_date_gmt) : null);
  if (input.cancelled_date_gmt !== undefined) addField('cancelled_date_gmt', input.cancelled_date_gmt ? new Date(input.cancelled_date_gmt) : null);
  if (input.end_date_gmt !== undefined) addField('end_date_gmt', input.end_date_gmt ? new Date(input.end_date_gmt) : null);
  if (input.payment_retry_date_gmt !== undefined) addField('payment_retry_date_gmt', input.payment_retry_date_gmt ? new Date(input.payment_retry_date_gmt) : null);

  // Handle status-specific dates
  if (input.status === 'cancelled' || input.status === 'pending-cancel') {
    addField('cancelled_date_gmt', new Date());
  }
  if (input.status === 'active') {
    addField('date_completed', new Date());
    addField('date_completed_gmt', new Date());
  }

  // Build and execute update query
  const setClause = updateFields.join(', ');
  const updateQuery = `UPDATE subscriptions SET ${setClause} WHERE id = ${id} AND is_deleted = false RETURNING *`;

  // Execute using raw SQL
  const result = await db.execute(sql.raw(updateQuery));

  if (result.rows.length === 0) return null;

  // Update line items if provided
  if (input.line_items !== undefined) {
    await db.execute(sql`DELETE FROM subscription_items WHERE subscription_id = ${id}`);
    if (input.line_items.length > 0) {
      await processLineItems(id, input.line_items);
    }
    await calculateSubscriptionTotals(id);
  }

  // Update shipping lines if provided
  if (input.shipping_lines !== undefined) {
    await db.execute(sql`DELETE FROM subscription_shipping_lines WHERE subscription_id = ${id}`);
    if (input.shipping_lines.length > 0) {
      await processShippingLines(id, input.shipping_lines);
    }
    await calculateSubscriptionTotals(id);
  }

  // Refetch with updated totals
  const finalResult = await db.execute(sql`SELECT * FROM subscriptions WHERE id = ${id} LIMIT 1`);
  return finalResult.rows[0] as unknown as Subscription;
};

/**
 * Delete a subscription (soft delete)
 */
export const deleteSubscription = async (id: number, force = false): Promise<Subscription | null> => {
  const existing = await getSubscription(id);
  if (!existing) return null;

  if (force) {
    // Delete related records first
    await db.execute(sql`DELETE FROM subscription_items WHERE subscription_id = ${id}`);
    await db.execute(sql`DELETE FROM subscription_shipping_lines WHERE subscription_id = ${id}`);
    await db.execute(sql`DELETE FROM subscription_tax_lines WHERE subscription_id = ${id}`);
    await db.execute(sql`DELETE FROM subscription_fee_lines WHERE subscription_id = ${id}`);
    await db.execute(sql`DELETE FROM subscription_coupon_lines WHERE subscription_id = ${id}`);
    await db.execute(sql`DELETE FROM subscription_notes WHERE subscription_id = ${id}`);
    await db.execute(sql`DELETE FROM subscriptions WHERE id = ${id}`);
    return existing;
  }

  await db.execute(sql`
    UPDATE subscriptions SET is_deleted = true, status = 'cancelled', date_modified = NOW(), date_modified_gmt = NOW()
    WHERE id = ${id}
  `);

  const result = await db.execute(sql`SELECT * FROM subscriptions WHERE id = ${id} LIMIT 1`);
  return result.rows[0] as unknown as Subscription;
};

// ========== SUBSCRIPTION STATUSES ==========

/**
 * Get all subscription statuses with counts
 */
export const getSubscriptionStatuses = async (): Promise<Array<{ slug: string; name: string; count: number }>> => {
  const statuses = [
    { slug: 'pending', name: 'Pending' },
    { slug: 'active', name: 'Active' },
    { slug: 'on-hold', name: 'On Hold' },
    { slug: 'cancelled', name: 'Cancelled' },
    { slug: 'switched', name: 'Switched' },
    { slug: 'expired', name: 'Expired' },
    { slug: 'pending-cancel', name: 'Pending Cancellation' },
  ];

  const result = await db.execute(sql`
    SELECT status, COUNT(*) as count FROM subscriptions WHERE is_deleted = false GROUP BY status
  `);

  const countMap = new Map(result.rows.map(r => [(r as { status: string }).status, Number((r as { count: string }).count)]));

  return statuses.map(s => ({
    slug: s.slug,
    name: s.name,
    count: countMap.get(s.slug) ?? 0,
  }));
};

// ========== SUBSCRIPTION NOTES ==========

/**
 * List subscription notes
 */
export const listSubscriptionNotes = async (
  subscriptionId: number,
  query: SubscriptionNoteListQuery
): Promise<SubscriptionNote[]> => {
  let whereClause = `subscription_id = ${subscriptionId}`;

  if (query.type === 'customer') {
    whereClause += ' AND is_customer_note = true';
  } else if (query.type === 'internal') {
    whereClause += ' AND is_customer_note = false';
  }

  const result = await db.execute(sql`
    SELECT * FROM subscription_notes WHERE ${sql.raw(whereClause)} ORDER BY date_created DESC
  `);

  return result.rows as unknown as SubscriptionNote[];
};

/**
 * Get a single subscription note
 */
export const getSubscriptionNote = async (subscriptionId: number, noteId: number): Promise<SubscriptionNote | null> => {
  const result = await db.execute(sql`
    SELECT * FROM subscription_notes WHERE id = ${noteId} AND subscription_id = ${subscriptionId} LIMIT 1
  `);

  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as SubscriptionNote;
};

/**
 * Create a subscription note
 */
export const createSubscriptionNote = async (
  subscriptionId: number,
  input: CreateSubscriptionNoteInput
): Promise<SubscriptionNote> => {
  const now = new Date();

  const result = await db.execute(sql`
    INSERT INTO subscription_notes (
      subscription_id, note, author, date_created, date_created_gmt, is_customer_note, added_by_user
    ) VALUES (
      ${subscriptionId},
      ${input.note},
      ${input.author ?? null},
      ${now},
      ${now},
      ${input.is_customer_note ?? false},
      ${input.added_by_user ?? false}
    ) RETURNING *
  `);

  return result.rows[0] as unknown as SubscriptionNote;
};

/**
 * Delete a subscription note (force is required)
 */
export const deleteSubscriptionNote = async (subscriptionId: number, noteId: number): Promise<SubscriptionNote | null> => {
  const existing = await getSubscriptionNote(subscriptionId, noteId);
  if (!existing) return null;

  await db.execute(sql`DELETE FROM subscription_notes WHERE id = ${noteId}`);
  return existing;
};

// ========== BATCH OPERATIONS ==========

export const batchCreateSubscriptions = async (inputs: CreateSubscriptionInput[]): Promise<Subscription[]> => {
  const results: Subscription[] = [];
  for (const input of inputs) {
    const subscription = await createSubscription(input);
    results.push(subscription);
  }
  return results;
};

export const batchUpdateSubscriptions = async (
  updates: Array<{ id: number } & UpdateSubscriptionInput>
): Promise<(Subscription | null)[]> => {
  const results: (Subscription | null)[] = [];
  for (const update of updates) {
    const subscription = await updateSubscription(update.id, update);
    results.push(subscription);
  }
  return results;
};

export const batchDeleteSubscriptions = async (ids: number[], force = false): Promise<(Subscription | null)[]> => {
  const results: (Subscription | null)[] = [];
  for (const id of ids) {
    const subscription = await deleteSubscription(id, force);
    results.push(subscription);
  }
  return results;
};

// Service export
export const subscriptionService = {
  list: listSubscriptions,
  get: getSubscription,
  create: createSubscription,
  update: updateSubscription,
  delete: deleteSubscription,
  // Related data
  getItems: getSubscriptionItems,
  getShippingLines: getSubscriptionShippingLines,
  getTaxLines: getSubscriptionTaxLines,
  getFeeLines: getSubscriptionFeeLines,
  getCouponLines: getSubscriptionCouponLines,
  // Statuses
  getStatuses: getSubscriptionStatuses,
  // Notes
  listNotes: listSubscriptionNotes,
  getNote: getSubscriptionNote,
  createNote: createSubscriptionNote,
  deleteNote: deleteSubscriptionNote,
  // Batch
  batchCreate: batchCreateSubscriptions,
  batchUpdate: batchUpdateSubscriptions,
  batchDelete: batchDeleteSubscriptions,
};

export default subscriptionService;
