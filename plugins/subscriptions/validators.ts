/**
 * Subscription Validation Schemas
 * WooCommerce Subscriptions REST API compatible
 */

import { z } from 'zod';
import { listQuerySchema } from '../../src/lib/pagination';

// Subscription statuses
export const subscriptionStatusSchema = z.enum([
  'pending',
  'active',
  'on-hold',
  'cancelled',
  'switched',
  'expired',
  'pending-cancel',
]);

// Billing period
export const billingPeriodSchema = z.enum(['day', 'week', 'month', 'year']);

// Address schemas (reuse from order pattern)
export const billingAddressSchema = z.object({
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  company: z.string().optional().default(''),
  address_1: z.string().optional().default(''),
  address_2: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  postcode: z.string().optional().default(''),
  country: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().default(''),
});

export const shippingAddressSchema = z.object({
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  company: z.string().optional().default(''),
  address_1: z.string().optional().default(''),
  address_2: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  postcode: z.string().optional().default(''),
  country: z.string().optional().default(''),
});

// Line item tax schema
export const lineItemTaxSchema = z.object({
  id: z.number().int().optional(),
  total: z.string().optional(),
  subtotal: z.string().optional(),
});

// Line item schema
export const lineItemSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().optional(),
  product_id: z.number().int(),
  variation_id: z.number().int().optional().default(0),
  quantity: z.number().int().optional().default(1),
  tax_class: z.string().optional(),
  subtotal: z.string().optional(),
  subtotal_tax: z.string().optional(),
  total: z.string().optional(),
  total_tax: z.string().optional(),
  taxes: z.array(lineItemTaxSchema).optional(),
  meta_data: z.array(z.object({ key: z.string(), value: z.unknown() })).optional(),
  sku: z.string().optional(),
  price: z.number().optional(),
});

// Shipping line schema
export const shippingLineSchema = z.object({
  id: z.number().int().optional(),
  method_title: z.string(),
  method_id: z.string(),
  total: z.string().optional().default('0.00'),
  total_tax: z.string().optional().default('0.00'),
  taxes: z.array(lineItemTaxSchema).optional(),
  meta_data: z.array(z.object({ key: z.string(), value: z.unknown() })).optional(),
});

// Fee line schema
export const feeLineSchema = z.object({
  id: z.number().int().optional(),
  name: z.string(),
  tax_class: z.string().optional(),
  tax_status: z.enum(['taxable', 'none']).optional().default('taxable'),
  total: z.string().optional().default('0.00'),
  total_tax: z.string().optional().default('0.00'),
  taxes: z.array(lineItemTaxSchema).optional(),
  meta_data: z.array(z.object({ key: z.string(), value: z.unknown() })).optional(),
});

// Coupon line schema
export const couponLineSchema = z.object({
  id: z.number().int().optional(),
  code: z.string(),
  discount: z.string().optional(),
  discount_tax: z.string().optional(),
  meta_data: z.array(z.object({ key: z.string(), value: z.unknown() })).optional(),
});

// Tax line schema
export const taxLineSchema = z.object({
  id: z.number().int().optional(),
  rate_code: z.string().optional(),
  rate_id: z.number().int().optional(),
  label: z.string().optional(),
  compound: z.boolean().optional().default(false),
  tax_total: z.string().optional().default('0.00'),
  shipping_tax_total: z.string().optional().default('0.00'),
  meta_data: z.array(z.object({ key: z.string(), value: z.unknown() })).optional(),
});

// Meta data schema
export const metaDataSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

// Date string schema (ISO 8601)
const dateStringSchema = z.string().datetime({ offset: true }).optional();

// Create subscription schema
export const createSubscriptionSchema = z.object({
  parent_id: z.number().int().optional().default(0),
  status: subscriptionStatusSchema.optional().default('pending'),
  currency: z.string().length(3).optional().default('USD'),
  customer_id: z.number().int().optional().default(0),
  customer_note: z.string().optional(),
  billing: billingAddressSchema.optional(),
  shipping: shippingAddressSchema.optional(),
  payment_method: z.string().optional(),
  payment_method_title: z.string().optional(),
  transaction_id: z.string().optional(),

  // Subscription-specific fields
  billing_period: billingPeriodSchema.optional().default('month'),
  billing_interval: z.number().int().min(1).optional().default(1),
  start_date_gmt: dateStringSchema,
  trial_end_date_gmt: dateStringSchema,
  next_payment_date_gmt: dateStringSchema,
  last_payment_date_gmt: dateStringSchema,
  cancelled_date_gmt: dateStringSchema,
  end_date_gmt: dateStringSchema,
  payment_retry_date_gmt: dateStringSchema,

  // Line items
  line_items: z.array(lineItemSchema).optional(),
  shipping_lines: z.array(shippingLineSchema).optional(),
  fee_lines: z.array(feeLineSchema).optional(),
  coupon_lines: z.array(couponLineSchema).optional(),

  // Meta data
  meta_data: z.array(metaDataSchema).optional(),
});

// Update subscription schema (all fields optional)
export const updateSubscriptionSchema = createSubscriptionSchema.partial();

// Subscription list query schema
export const subscriptionListQuerySchema = listQuerySchema.extend({
  status: z.union([
    subscriptionStatusSchema,
    z.array(subscriptionStatusSchema)
  ]).transform(v => Array.isArray(v) ? v : [v]).optional(),
  customer: z.coerce.number().int().optional(),
  product: z.coerce.number().int().optional(),
  dp: z.coerce.number().int().min(0).max(8).optional().default(2),
});

// Batch subscriptions schema
export const batchSubscriptionsSchema = z.object({
  create: z.array(createSubscriptionSchema).optional(),
  update: z.array(updateSubscriptionSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

// Create subscription note schema
export const createSubscriptionNoteSchema = z.object({
  note: z.string().min(1),
  author: z.string().optional(),
  is_customer_note: z.boolean().optional().default(false),
  added_by_user: z.boolean().optional().default(false),
});

// Note list query schema
export const noteListQuerySchema = z.object({
  type: z.enum(['any', 'customer', 'internal']).optional().default('any'),
});

// Type exports
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type SubscriptionListQuery = z.infer<typeof subscriptionListQuerySchema>;
export type BatchSubscriptionsInput = z.infer<typeof batchSubscriptionsSchema>;
export type CreateSubscriptionNoteInput = z.infer<typeof createSubscriptionNoteSchema>;
export type SubscriptionNoteListQuery = z.infer<typeof noteListQuerySchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type ShippingLineInput = z.infer<typeof shippingLineSchema>;
export type BillingAddress = z.infer<typeof billingAddressSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
