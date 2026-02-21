/**
 * Product Variation Validation Schemas
 */

import { z } from 'zod';
import { listQuerySchema } from '../lib/pagination';
import { stockStatusSchema, backordersSchema, taxStatusSchema } from './product.validators';

export const variationAttributeInputSchema = z.object({
  id: z.number().int().optional(),
  name: z.string(),
  option: z.string(),
});

export const createVariationSchema = z.object({
  description: z.string().optional(),
  sku: z.string().optional(),
  regular_price: z.string().optional(),
  sale_price: z.string().optional(),
  date_on_sale_from: z.string().datetime().nullable().optional(),
  date_on_sale_from_gmt: z.string().datetime().nullable().optional(),
  date_on_sale_to: z.string().datetime().nullable().optional(),
  date_on_sale_to_gmt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'pending', 'private', 'publish']).optional().default('publish'),
  virtual: z.boolean().optional().default(false),
  downloadable: z.boolean().optional().default(false),
  downloads: z.array(z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    file: z.string().optional(),
  })).optional(),
  download_limit: z.number().int().optional().default(-1),
  download_expiry: z.number().int().optional().default(-1),
  tax_status: taxStatusSchema.optional().default('taxable'),
  tax_class: z.string().optional(),
  manage_stock: z.boolean().optional().default(false),
  stock_quantity: z.number().int().nullable().optional(),
  stock_status: stockStatusSchema.optional().default('instock'),
  backorders: backordersSchema.optional().default('no'),
  weight: z.string().optional(),
  dimensions: z.object({
    length: z.string().optional(),
    width: z.string().optional(),
    height: z.string().optional(),
  }).optional(),
  shipping_class: z.string().optional(),
  image: z.object({
    id: z.number().int().optional(),
    src: z.string().optional(),
    name: z.string().optional(),
    alt: z.string().optional(),
  }).optional(),
  attributes: z.array(variationAttributeInputSchema).optional(),
  menu_order: z.number().int().optional().default(0),
  meta_data: z.array(z.object({
    key: z.string(),
    value: z.unknown(),
  })).optional(),
});

export const updateVariationSchema = createVariationSchema.partial();

export const variationListQuerySchema = listQuerySchema;

export const batchVariationsSchema = z.object({
  create: z.array(createVariationSchema).optional(),
  update: z.array(updateVariationSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

export type CreateVariationInput = z.infer<typeof createVariationSchema>;
export type UpdateVariationInput = z.infer<typeof updateVariationSchema>;
export type VariationListQuery = z.infer<typeof variationListQuerySchema>;
export type BatchVariationsInput = z.infer<typeof batchVariationsSchema>;
