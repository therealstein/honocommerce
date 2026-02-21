/**
 * Product Variations Schema
 */

import { pgTable, serial, varchar, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const productVariations = pgTable('product_variations', {
  id: serial('id').primaryKey(),
  
  // Parent product
  parentId: integer('parent_id').notNull(),
  
  // Basic info
  description: text('description'),
  sku: varchar('sku', { length: 100 }),
  
  // Pricing
  price: varchar('price', { length: 20 }),
  regularPrice: varchar('regular_price', { length: 20 }),
  salePrice: varchar('sale_price', { length: 20 }),
  
  // Sale dates
  dateOnSaleFrom: timestamp('date_on_sale_from'),
  dateOnSaleFromGmt: timestamp('date_on_sale_from_gmt'),
  dateOnSaleTo: timestamp('date_on_sale_to'),
  dateOnSaleToGmt: timestamp('date_on_sale_to_gmt'),
  
  // Status
  status: varchar('status', { length: 20 }).notNull().default('publish'),
  
  // Virtual/downloadable
  virtual: boolean('virtual').notNull().default(false),
  downloadable: boolean('downloadable').notNull().default(false),
  downloads: jsonb('downloads').notNull().default([]),
  downloadLimit: integer('download_limit').notNull().default(-1),
  downloadExpiry: integer('download_expiry').notNull().default(-1),
  
  // Tax
  taxStatus: varchar('tax_status', { length: 20 }).notNull().default('taxable'),
  taxClass: varchar('tax_class', { length: 50 }),
  
  // Inventory
  manageStock: boolean('manage_stock').notNull().default(false),
  stockQuantity: integer('stock_quantity'),
  stockStatus: varchar('stock_status', { length: 20 }).notNull().default('instock'),
  backorders: varchar('backorders', { length: 20 }).notNull().default('no'),
  
  // Shipping
  weight: varchar('weight', { length: 20 }),
  length: varchar('length', { length: 20 }),
  width: varchar('width', { length: 20 }),
  height: varchar('height', { length: 20 }),
  shippingClassId: integer('shipping_class_id').notNull().default(0),
  
  // Image
  imageId: integer('image_id'),
  
  // Menu order
  menuOrder: integer('menu_order').notNull().default(0),
  
  // Timestamps
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateCreatedGmt: timestamp('date_created_gmt').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
  dateModifiedGmt: timestamp('date_modified_gmt').notNull().defaultNow(),
});

// Variation attributes
export const variationAttributes = pgTable('variation_attributes', {
  variationId: integer('variation_id').notNull(),
  attributeId: integer('attribute_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  option: varchar('option', { length: 100 }).notNull(),
});

export type ProductVariation = typeof productVariations.$inferSelect;
export type NewProductVariation = typeof productVariations.$inferInsert;
