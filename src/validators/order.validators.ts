/**
 * Order Validation Schemas
 */

import { z } from 'zod';
import { listQuerySchema } from '../lib/pagination';

// Order statuses
export const orderStatusSchema = z.enum(['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed', 'trash']);

// Address schemas
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

// Line item schemas
export const lineItemTaxSchema = z.object({
  id: z.number().int().optional(),
  total: z.string().optional(),
  subtotal: z.string().optional(),
});

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

// Create order schema
export const createOrderSchema = z.object({
  parent_id: z.number().int().optional().default(0),
  status: orderStatusSchema.optional().default('pending'),
  currency: z.string().length(3).optional().default('USD'),
  customer_id: z.number().int().optional().default(0),
  customer_note: z.string().optional(),
  billing: billingAddressSchema.optional(),
  shipping: shippingAddressSchema.optional(),
  payment_method: z.string().optional(),
  payment_method_title: z.string().optional(),
  transaction_id: z.string().optional(),
  meta_data: z.array(metaDataSchema).optional(),
  line_items: z.array(lineItemSchema).optional(),
  shipping_lines: z.array(shippingLineSchema).optional(),
  fee_lines: z.array(feeLineSchema).optional(),
  coupon_lines: z.array(couponLineSchema).optional(),
  set_paid: z.boolean().optional().default(false),
});

// Update order schema
export const updateOrderSchema = createOrderSchema.partial();

// Order list query schema
export const orderListQuerySchema = listQuerySchema.extend({
  status: z.union([
    orderStatusSchema,
    z.array(orderStatusSchema)
  ]).transform(v => Array.isArray(v) ? v : [v]).optional(),
  customer: z.coerce.number().int().optional(),
  product: z.coerce.number().int().optional(),
  dp: z.coerce.number().int().min(0).max(8).optional().default(2),
});

// Batch orders schema
export const batchOrdersSchema = z.object({
  create: z.array(createOrderSchema).optional(),
  update: z.array(updateOrderSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

// Refund schemas
export const createRefundSchema = z.object({
  amount: z.string(),
  reason: z.string().optional(),
  refunded_by: z.number().int().optional(),
  meta_data: z.array(metaDataSchema).optional(),
  api_refund: z.boolean().optional().default(true),
});

// Type exports
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type BatchOrdersInput = z.infer<typeof batchOrdersSchema>;
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type ShippingLineInput = z.infer<typeof shippingLineSchema>;
export type BillingAddress = z.infer<typeof billingAddressSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
