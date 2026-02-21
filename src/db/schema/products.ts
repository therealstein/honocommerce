/**
 * Products Schema
 * Core product data structure
 */

import { pgTable, serial, varchar, text, timestamp, boolean, integer, decimal, jsonb } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  
  // Basic info
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  
  // Product type: simple, grouped, external, variable
  type: varchar('type', { length: 20 }).notNull().default('simple'),
  
  // Status: draft, pending, private, publish
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  
  // Featured flag
  featured: boolean('featured').notNull().default(false),
  
  // Catalog visibility: visible, catalog, search, hidden
  catalogVisibility: varchar('catalog_visibility', { length: 20 }).notNull().default('visible'),
  
  // Descriptions
  description: text('description'),
  shortDescription: text('short_description'),
  
  // SKU
  sku: varchar('sku', { length: 100 }).unique(),
  
  // Pricing (stored as strings for WooCommerce compatibility)
  price: varchar('price', { length: 20 }),
  regularPrice: varchar('regular_price', { length: 20 }),
  salePrice: varchar('sale_price', { length: 20 }),
  
  // Sale dates
  dateOnSaleFrom: timestamp('date_on_sale_from'),
  dateOnSaleFromGmt: timestamp('date_on_sale_from_gmt'),
  dateOnSaleTo: timestamp('date_on_sale_to'),
  dateOnSaleToGmt: timestamp('date_on_sale_to_gmt'),
  
  // Virtual/downloadable flags
  virtual: boolean('virtual').notNull().default(false),
  downloadable: boolean('downloadable').notNull().default(false),
  
  // Downloads JSON array
  downloads: jsonb('downloads').notNull().default([]),
  
  // Download limits
  downloadLimit: integer('download_limit').notNull().default(-1),
  downloadExpiry: integer('download_expiry').notNull().default(-1),
  
  // External product URL
  externalUrl: varchar('external_url', { length: 255 }),
  buttonText: varchar('button_text', { length: 255 }),
  
  // Tax
  taxStatus: varchar('tax_status', { length: 20 }).notNull().default('taxable'),
  taxClass: varchar('tax_class', { length: 50 }),
  
  // Inventory management
  manageStock: boolean('manage_stock').notNull().default(false),
  stockQuantity: integer('stock_quantity'),
  stockStatus: varchar('stock_status', { length: 20 }).notNull().default('instock'),
  backorders: varchar('backorders', { length: 20 }).notNull().default('no'),
  soldIndividually: boolean('sold_individually').notNull().default(false),
  
  // Shipping
  weight: varchar('weight', { length: 20 }),
  length: varchar('length', { length: 20 }),
  width: varchar('width', { length: 20 }),
  height: varchar('height', { length: 20 }),
  shippingClassId: integer('shipping_class_id').notNull().default(0),
  
  // Reviews
  reviewsAllowed: boolean('reviews_allowed').notNull().default(true),
  
  // Parent product (for variations)
  parentId: integer('parent_id').notNull().default(0),
  
  // Purchase note
  purchaseNote: text('purchase_note'),
  
  // Menu order
  menuOrder: integer('menu_order').notNull().default(0),
  
  // Total sales count
  totalSales: integer('total_sales').notNull().default(0),
  
  // Timestamps
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateCreatedGmt: timestamp('date_created_gmt').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
  dateModifiedGmt: timestamp('date_modified_gmt').notNull().defaultNow(),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
});

// Product categories junction table
export const productCategories = pgTable('product_categories', {
  productId: integer('product_id').notNull(),
  categoryId: integer('category_id').notNull(),
});

// Product tags junction table
export const productTags = pgTable('product_tags', {
  productId: integer('product_id').notNull(),
  tagId: integer('tag_id').notNull(),
});

// Product images table
export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  src: varchar('src', { length: 500 }).notNull(),
  name: varchar('name', { length: 255 }),
  alt: varchar('alt', { length: 255 }),
  position: integer('position').notNull().default(0),
  dateCreated: timestamp('date_created').notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
