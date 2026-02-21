/**
 * Coupons Schema
 */

import { pgTable, serial, varchar, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  
  // Coupon code (unique)
  code: varchar('code', { length: 100 }).notNull().unique(),
  
  // Amount
  amount: varchar('amount', { length: 20 }).notNull(),
  
  // Dates
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateCreatedGmt: timestamp('date_created_gmt').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
  dateModifiedGmt: timestamp('date_modified_gmt').notNull().defaultNow(),
  
  // Discount type: percent, fixed_cart, fixed_product
  discountType: varchar('discount_type', { length: 20 }).notNull().default('fixed_cart'),
  
  // Description
  description: text('description'),
  
  // Expiry date
  dateExpires: timestamp('date_expires'),
  dateExpiresGmt: timestamp('date_expires_gmt'),
  
  // Usage count
  usageCount: integer('usage_count').notNull().default(0),
  
  // Individual use only
  individualUse: boolean('individual_use').notNull().default(false),
  
  // Product IDs this coupon applies to
  productIds: jsonb('product_ids').notNull().default([]).$type<number[]>(),
  
  // Excluded product IDs
  excludedProductIds: jsonb('excluded_product_ids').notNull().default([]).$type<number[]>(),
  
  // Usage limits
  usageLimit: integer('usage_limit'),
  usageLimitPerUser: integer('usage_limit_per_user'),
  limitUsageToXItems: integer('limit_usage_to_x_items'),
  
  // Free shipping
  freeShipping: boolean('free_shipping').notNull().default(false),
  
  // Product categories
  productCategories: jsonb('product_categories').notNull().default([]).$type<number[]>(),
  excludedProductCategories: jsonb('excluded_product_categories').notNull().default([]).$type<number[]>(),
  
  // Exclude sale items
  excludeSaleItems: boolean('exclude_sale_items').notNull().default(false),
  
  // Minimum/maximum spend
  minimumAmount: varchar('minimum_amount', { length: 20 }),
  maximumAmount: varchar('maximum_amount', { length: 20 }),
  
  // Email restrictions
  emailRestrictions: jsonb('email_restrictions').notNull().default([]).$type<string[]>(),
  
  // Used by (customer IDs)
  usedBy: jsonb('used_by').notNull().default([]).$type<number[]>(),
  
  // Meta data
  metaData: jsonb('meta_data').notNull().default([]),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
});

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
