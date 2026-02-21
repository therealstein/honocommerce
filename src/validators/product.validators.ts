/**
 * Product Validation Schemas
 * Zod schemas for product request validation
 */

import { z } from 'zod';
import { listQuerySchema } from '../lib/pagination';

/**
 * Product types
 */
export const productTypeSchema = z.enum(['simple', 'grouped', 'external', 'variable']);

/**
 * Product statuses
 */
export const productStatusSchema = z.enum(['draft', 'pending', 'private', 'publish', 'trash']);

/**
 * Catalog visibility options
 */
export const catalogVisibilitySchema = z.enum(['visible', 'catalog', 'search', 'hidden']);

/**
 * Tax status options
 */
export const taxStatusSchema = z.enum(['taxable', 'shipping', 'none']);

/**
 * Stock status options
 */
export const stockStatusSchema = z.enum(['instock', 'outofstock', 'onbackorder']);

/**
 * Backorder options
 */
export const backordersSchema = z.enum(['no', 'notify', 'yes']);

/**
 * Image schema for create/update
 */
export const productImageInputSchema = z.object({
  id: z.number().int().optional(),
  src: z.string().url().optional(),
  name: z.string().optional(),
  alt: z.string().optional(),
  position: z.number().int().optional(),
});

/**
 * Category schema for create/update
 */
export const productCategoryInputSchema = z.object({
  id: z.number().int(),
});

/**
 * Tag schema for create/update
 */
export const productTagInputSchema = z.object({
  id: z.number().int(),
});

/**
 * Attribute schema for create/update
 */
export const productAttributeInputSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().optional(),
  position: z.number().int().optional(),
  visible: z.boolean().optional(),
  variation: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

/**
 * Meta data schema
 */
export const metaDataSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

/**
 * Download schema
 */
export const downloadSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  file: z.string().optional(),
});

/**
 * Product create schema
 */
export const createProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  type: productTypeSchema.optional().default('simple'),
  status: productStatusSchema.optional().default('draft'),
  featured: z.boolean().optional().default(false),
  catalog_visibility: catalogVisibilitySchema.optional().default('visible'),
  description: z.string().optional(),
  short_description: z.string().optional(),
  sku: z.string().optional(),
  regular_price: z.string().optional(),
  sale_price: z.string().optional(),
  date_on_sale_from: z.string().datetime().nullable().optional(),
  date_on_sale_from_gmt: z.string().datetime().nullable().optional(),
  date_on_sale_to: z.string().datetime().nullable().optional(),
  date_on_sale_to_gmt: z.string().datetime().nullable().optional(),
  virtual: z.boolean().optional().default(false),
  downloadable: z.boolean().optional().default(false),
  downloads: z.array(downloadSchema).optional(),
  download_limit: z.number().int().optional().default(-1),
  download_expiry: z.number().int().optional().default(-1),
  external_url: z.string().url().optional(),
  button_text: z.string().optional(),
  tax_status: taxStatusSchema.optional().default('taxable'),
  tax_class: z.string().optional(),
  manage_stock: z.boolean().optional().default(false),
  stock_quantity: z.number().int().nullable().optional(),
  stock_status: stockStatusSchema.optional().default('instock'),
  backorders: backordersSchema.optional().default('no'),
  sold_individually: z.boolean().optional().default(false),
  weight: z.string().optional(),
  dimensions: z.object({
    length: z.string().optional(),
    width: z.string().optional(),
    height: z.string().optional(),
  }).optional(),
  shipping_class: z.string().optional(),
  reviews_allowed: z.boolean().optional().default(true),
  upsell_ids: z.array(z.number().int()).optional(),
  cross_sell_ids: z.array(z.number().int()).optional(),
  parent_id: z.number().int().optional().default(0),
  purchase_note: z.string().optional(),
  categories: z.array(productCategoryInputSchema).optional(),
  tags: z.array(productTagInputSchema).optional(),
  images: z.array(productImageInputSchema).optional(),
  attributes: z.array(productAttributeInputSchema).optional(),
  default_attributes: z.array(productAttributeInputSchema).optional(),
  menu_order: z.number().int().optional().default(0),
  meta_data: z.array(metaDataSchema).optional(),
});

/**
 * Product update schema (all fields optional except we need at least one)
 */
export const updateProductSchema = createProductSchema.partial();

/**
 * Product list query schema (extends standard pagination)
 */
export const productListQuerySchema = listQuerySchema.extend({
  type: productTypeSchema.optional(),
  status: productStatusSchema.optional(),
  featured: z.coerce.boolean().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  sku: z.string().optional(),
  on_sale: z.coerce.boolean().optional(),
  min_price: z.string().optional(),
  max_price: z.string().optional(),
  stock_status: stockStatusSchema.optional(),
  slug: z.string().optional(),
});

/**
 * Batch operation schema
 */
export const batchProductsSchema = z.object({
  create: z.array(createProductSchema).optional(),
  update: z.array(updateProductSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

// Type exports
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type BatchProductsInput = z.infer<typeof batchProductsSchema>;
