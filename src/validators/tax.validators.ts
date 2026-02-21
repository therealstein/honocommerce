/**
 * Taxes Validation Schemas
 */

import { z } from 'zod';
import { listQuerySchema } from '../lib/pagination';

// Tax Rate validators
export const createTaxRateSchema = z.object({
  country: z.string().max(2).optional().default(''),
  state: z.string().optional().default(''),
  postcode: z.string().optional().default(''),
  city: z.string().optional().default(''),
  rate: z.string().min(1),
  name: z.string().min(1),
  priority: z.number().int().optional().default(1),
  compound: z.boolean().optional().default(false),
  shipping: z.boolean().optional().default(true),
  order: z.number().int().optional().default(0),
  class: z.string().optional().default(''),
});

export const updateTaxRateSchema = createTaxRateSchema.partial();

export const taxRateListQuerySchema = listQuerySchema.extend({
  class: z.string().optional(),
});

export const batchTaxRatesSchema = z.object({
  create: z.array(createTaxRateSchema).optional(),
  update: z.array(updateTaxRateSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

// Tax Class validators
export const createTaxClassSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
});

export type CreateTaxRateInput = z.infer<typeof createTaxRateSchema>;
export type UpdateTaxRateInput = z.infer<typeof updateTaxRateSchema>;
export type TaxRateListQuery = z.infer<typeof taxRateListQuerySchema>;
export type BatchTaxRatesInput = z.infer<typeof batchTaxRatesSchema>;
export type CreateTaxClassInput = z.infer<typeof createTaxClassSchema>;
