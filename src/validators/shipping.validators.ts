/**
 * Shipping Validation Schemas
 */

import { z } from 'zod';

// Shipping Zone validators
export const createShippingZoneSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().optional().default(0),
});

export const updateShippingZoneSchema = createShippingZoneSchema.partial();

// Shipping Zone Location validators
export const locationTypeSchema = z.enum(['postcode', 'state', 'country', 'continent']);

export const createShippingZoneLocationSchema = z.object({
  code: z.string().min(1),
  type: locationTypeSchema,
});

export const updateShippingZoneLocationSchema = createShippingZoneLocationSchema.partial();

export const batchLocationsSchema = z.object({
  create: z.array(createShippingZoneLocationSchema).optional(),
});

// Shipping Method validators
export const methodIdSchema = z.enum(['flat_rate', 'free_shipping', 'local_pickup']);

export const createShippingMethodSchema = z.object({
  method_id: methodIdSchema,
  order: z.number().int().optional().default(0),
  enabled: z.boolean().optional().default(true),
  settings: z.record(z.unknown()).optional(),
});

export const updateShippingMethodSchema = z.object({
  title: z.string().optional(),
  order: z.number().int().optional(),
  enabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

// Shipping Class validators
export const createShippingClassSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
});

export const updateShippingClassSchema = createShippingClassSchema.partial();

export type CreateShippingZoneInput = z.infer<typeof createShippingZoneSchema>;
export type UpdateShippingZoneInput = z.infer<typeof updateShippingZoneSchema>;
export type CreateShippingZoneLocationInput = z.infer<typeof createShippingZoneLocationSchema>;
export type CreateShippingMethodInput = z.infer<typeof createShippingMethodSchema>;
export type UpdateShippingMethodInput = z.infer<typeof updateShippingMethodSchema>;
export type CreateShippingClassInput = z.infer<typeof createShippingClassSchema>;
export type UpdateShippingClassInput = z.infer<typeof updateShippingClassSchema>;
