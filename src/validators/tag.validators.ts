/**
 * Product Tag Validation Schemas
 */

import { z } from 'zod';
import { listQuerySchema } from '../lib/pagination';

export const createTagSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
});

export const updateTagSchema = createTagSchema.partial();

export const tagListQuerySchema = listQuerySchema.extend({
  hide_empty: z.coerce.boolean().optional(),
});

export const batchTagsSchema = z.object({
  create: z.array(createTagSchema).optional(),
  update: z.array(updateTagSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type TagListQuery = z.infer<typeof tagListQuerySchema>;
export type BatchTagsInput = z.infer<typeof batchTagsSchema>;
