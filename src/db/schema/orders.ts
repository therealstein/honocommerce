/**
 * Orders Schema
 */

import { pgTable, serial, varchar, text, timestamp, boolean, integer, decimal, jsonb } from 'drizzle-orm/pg-core';

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  
  // Order number and key
  number: varchar('number', { length: 50 }),
  orderKey: varchar('order_key', { length: 100 }),
  
  // Parent order (for refunds)
  parentId: integer('parent_id').notNull().default(0),
  
  // Status: pending, processing, on-hold, completed, cancelled, refunded, failed
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  
  // Currency
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  
  // Created via
  createdVia: varchar('created_via', { length: 50 }),
  version: varchar('version', { length: 20 }),
  
  // Customer
  customerId: integer('customer_id').notNull().default(0),
  
  // Customer IP and user agent
  customerIpAddress: varchar('customer_ip_address', { length: 45 }),
  customerUserAgent: varchar('customer_user_agent', { length: 255 }),
  
  // Customer note
  customerNote: text('customer_note'),
  
  // Billing address
  billing: jsonb('billing').notNull().$type<{
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  }>(),
  
  // Shipping address
  shipping: jsonb('shipping').notNull().$type<{
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  }>(),
  
  // Payment
  paymentMethod: varchar('payment_method', { length: 50 }),
  paymentMethodTitle: varchar('payment_method_title', { length: 100 }),
  transactionId: varchar('transaction_id', { length: 100 }),
  
  // Totals (as strings for WooCommerce compatibility)
  discountTotal: varchar('discount_total', { length: 20 }).notNull().default('0.00'),
  discountTax: varchar('discount_tax', { length: 20 }).notNull().default('0.00'),
  shippingTotal: varchar('shipping_total', { length: 20 }).notNull().default('0.00'),
  shippingTax: varchar('shipping_tax', { length: 20 }).notNull().default('0.00'),
  cartTax: varchar('cart_tax', { length: 20 }).notNull().default('0.00'),
  total: varchar('total', { length: 20 }).notNull().default('0.00'),
  totalTax: varchar('total_tax', { length: 20 }).notNull().default('0.00'),
  
  // Prices include tax
  pricesIncludeTax: boolean('prices_include_tax').notNull().default(false),
  
  // Cart hash
  cartHash: varchar('cart_hash', { length: 64 }),
  
  // Dates
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateCreatedGmt: timestamp('date_created_gmt').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
  dateModifiedGmt: timestamp('date_modified_gmt').notNull().defaultNow(),
  datePaid: timestamp('date_paid'),
  datePaidGmt: timestamp('date_paid_gmt'),
  dateCompleted: timestamp('date_completed'),
  dateCompletedGmt: timestamp('date_completed_gmt'),
  
  // Meta data
  metaData: jsonb('meta_data').notNull().default([]),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
});

// Order line items
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  
  // Item name
  name: varchar('name', { length: 255 }).notNull(),
  
  // Product reference
  productId: integer('product_id').notNull(),
  variationId: integer('variation_id').notNull().default(0),
  
  // Quantity and pricing
  quantity: integer('quantity').notNull().default(1),
  taxClass: varchar('tax_class', { length: 50 }),
  subtotal: varchar('subtotal', { length: 20 }).notNull().default('0.00'),
  subtotalTax: varchar('subtotal_tax', { length: 20 }).notNull().default('0.00'),
  total: varchar('total', { length: 20 }).notNull().default('0.00'),
  totalTax: varchar('total_tax', { length: 20 }).notNull().default('0.00'),
  
  // SKU and price
  sku: varchar('sku', { length: 100 }),
  price: decimal('price', { precision: 10, scale: 2 }),
  
  // Taxes array
  taxes: jsonb('taxes').notNull().default([]),
  
  // Meta data
  metaData: jsonb('meta_data').notNull().default([]),
});

// Order tax lines
export const orderTaxLines = pgTable('order_tax_lines', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  
  rateCode: varchar('rate_code', { length: 100 }).notNull(),
  rateId: integer('rate_id').notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  compound: boolean('compound').notNull().default(false),
  taxTotal: varchar('tax_total', { length: 20 }).notNull().default('0.00'),
  shippingTaxTotal: varchar('shipping_tax_total', { length: 20 }).notNull().default('0.00'),
  metaData: jsonb('meta_data').notNull().default([]),
});

// Order shipping lines
export const orderShippingLines = pgTable('order_shipping_lines', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  
  methodTitle: varchar('method_title', { length: 100 }).notNull(),
  methodId: varchar('method_id', { length: 50 }).notNull(),
  total: varchar('total', { length: 20 }).notNull().default('0.00'),
  totalTax: varchar('total_tax', { length: 20 }).notNull().default('0.00'),
  taxes: jsonb('taxes').notNull().default([]),
  metaData: jsonb('meta_data').notNull().default([]),
});

// Order fee lines
export const orderFeeLines = pgTable('order_fee_lines', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  
  name: varchar('name', { length: 255 }).notNull(),
  taxClass: varchar('tax_class', { length: 50 }),
  taxStatus: varchar('tax_status', { length: 20 }).notNull().default('taxable'),
  total: varchar('total', { length: 20 }).notNull().default('0.00'),
  totalTax: varchar('total_tax', { length: 20 }).notNull().default('0.00'),
  taxes: jsonb('taxes').notNull().default([]),
  metaData: jsonb('meta_data').notNull().default([]),
});

// Order coupon lines
export const orderCouponLines = pgTable('order_coupon_lines', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  
  code: varchar('code', { length: 100 }).notNull(),
  discount: varchar('discount', { length: 20 }).notNull().default('0.00'),
  discountTax: varchar('discount_tax', { length: 20 }).notNull().default('0.00'),
  metaData: jsonb('meta_data').notNull().default([]),
});

// Order refunds
export const orderRefunds = pgTable('order_refunds', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  
  amount: varchar('amount', { length: 20 }).notNull(),
  reason: text('reason'),
  
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateCreatedGmt: timestamp('date_created_gmt').notNull().defaultNow(),
  
  metaData: jsonb('meta_data').notNull().default([]),
});

// Order notes
export const orderNotes = pgTable('order_notes', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  
  // Note content
  note: text('note').notNull(),
  
  // Author (0 = system, customer ID = customer, user ID = admin)
  author: integer('author').notNull().default(0),
  
  // Date created
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateCreatedGmt: timestamp('date_created_gmt').notNull().defaultNow(),
  
  // Is this a customer note? (visible to customer)
  isCustomerNote: boolean('is_customer_note').notNull().default(false),
  
  // Added by user (for tracking who added the note)
  addedByUser: boolean('added_by_user').notNull().default(false),
  
  // System note (auto-generated)
  isSystem: boolean('is_system').notNull().default(false),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderRefund = typeof orderRefunds.$inferSelect;
export type NewOrderRefund = typeof orderRefunds.$inferInsert;
export type OrderNote = typeof orderNotes.$inferSelect;
export type NewOrderNote = typeof orderNotes.$inferInsert;
