/**
 * Coupon Validation Schemas
 */

import { z } from 'zod';
import { listQuerySchema } from '../lib/pagination';

export const discountTypeSchema = z.enum(['percent', 'fixed_cart', 'fixed_product']);

export const createCouponSchema = z.object({
  code: z.string().min(1),
  amount: z.string(),
  discount_type: discountTypeSchema.optional().default('fixed_cart'),
  description: z.string().optional(),
  date_expires: z.string().datetime().nullable().optional(),
  date_expires_gmt: z.string().datetime().nullable().optional(),
  individual_use: z.boolean().optional().default(false),
  product_ids: z.array(z.number().int()).optional(),
  excluded_product_ids: z.array(z.number().int()).optional(),
  usage_limit: z.number().int().optional(),
  usage_limit_per_user: z.number().int().optional(),
  limit_usage_to_x_items: z.number().int().optional(),
  free_shipping: z.boolean().optional().default(false),
  product_categories: z.array(z.number().int()).optional(),
  excluded_product_categories: z.array(z.number().int()).optional(),
  exclude_sale_items: z.boolean().optional().default(false),
  minimum_amount: z.string().optional(),
  maximum_amount: z.string().optional(),
  email_restrictions: z.array(z.string()).optional(),
  meta_data: z.array(z.object({ key: z.string(), value: z.unknown() })).optional(),
});

export const updateCouponSchema = createCouponSchema.partial();

export const couponListQuerySchema = listQuerySchema.extend({
  code: z.string().optional(),
});

export const batchCouponsSchema = z.object({
  create: z.array(createCouponSchema).optional(),
  update: z.array(updateCouponSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type CouponListQuery = z.infer<typeof couponListQuerySchema>;
export type BatchCouponsInput = z.infer<typeof batchCouponsSchema>;
