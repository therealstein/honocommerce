/**
 * Product Category Validation Schemas
 */

import { z } from 'zod';
import { listQuerySchema } from '../lib/pagination';

export const categoryDisplaySchema = z.enum(['default', 'products', 'subcategories', 'both']);

export const categoryImageSchema = z.object({
  id: z.number().int().optional(),
  src: z.string().optional(),
  name: z.string().optional(),
  alt: z.string().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  parent: z.number().int().optional().default(0),
  description: z.string().optional(),
  display: categoryDisplaySchema.optional().default('default'),
  image: categoryImageSchema.optional(),
  menu_order: z.number().int().optional().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryListQuerySchema = listQuerySchema.extend({
  parent: z.coerce.number().int().optional(),
  hide_empty: z.coerce.boolean().optional(),
});

export const batchCategoriesSchema = z.object({
  create: z.array(createCategorySchema).optional(),
  update: z.array(updateCategorySchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
export type BatchCategoriesInput = z.infer<typeof batchCategoriesSchema>;
