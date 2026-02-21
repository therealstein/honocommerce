/**
 * Product Attribute Validation Schemas
 */

import { z } from 'zod';
import { listQuerySchema } from '../lib/pagination';

export const attributeTypeSchema = z.enum(['select']);

export const attributeOrderBySchema = z.enum(['menu_order', 'name', 'name_num', 'id']);

export const createAttributeSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  type: attributeTypeSchema.optional().default('select'),
  order_by: attributeOrderBySchema.optional().default('menu_order'),
  has_archives: z.boolean().optional().default(false),
});

export const updateAttributeSchema = createAttributeSchema.partial();

export const attributeListQuerySchema = listQuerySchema;

export const batchAttributesSchema = z.object({
  create: z.array(createAttributeSchema).optional(),
  update: z.array(updateAttributeSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

// Attribute Term schemas
export const createAttributeTermSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  menu_order: z.number().int().optional().default(0),
});

export const updateAttributeTermSchema = createAttributeTermSchema.partial();

export const attributeTermListQuerySchema = listQuerySchema.extend({
  hide_empty: z.coerce.boolean().optional(),
});

export const batchAttributeTermsSchema = z.object({
  create: z.array(createAttributeTermSchema).optional(),
  update: z.array(updateAttributeTermSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>;
export type AttributeListQuery = z.infer<typeof attributeListQuerySchema>;
export type BatchAttributesInput = z.infer<typeof batchAttributesSchema>;

export type CreateAttributeTermInput = z.infer<typeof createAttributeTermSchema>;
export type UpdateAttributeTermInput = z.infer<typeof updateAttributeTermSchema>;
export type AttributeTermListQuery = z.infer<typeof attributeTermListQuerySchema>;
export type BatchAttributeTermsInput = z.infer<typeof batchAttributeTermsSchema>;
