/**
 * Webhook Validation Schemas
 */

import { z } from 'zod';
import { listQuerySchema } from '../lib/pagination';

export const webhookStatusSchema = z.enum(['active', 'paused', 'disabled']);

export const webhookTopicSchema = z.enum([
  'coupon.created', 'coupon.updated', 'coupon.deleted',
  'customer.created', 'customer.updated', 'customer.deleted',
  'order.created', 'order.updated', 'order.deleted',
  'product.created', 'product.updated', 'product.deleted',
]);

export const createWebhookSchema = z.object({
  name: z.string().min(1),
  topic: webhookTopicSchema,
  delivery_url: z.string().url(),
  secret: z.string().optional(),
  status: webhookStatusSchema.optional().default('active'),
});

export const updateWebhookSchema = createWebhookSchema.partial();

export const webhookListQuerySchema = listQuerySchema.extend({
  status: webhookStatusSchema.optional(),
  topic: webhookTopicSchema.optional(),
});

export const batchWebhooksSchema = z.object({
  create: z.array(createWebhookSchema).optional(),
  update: z.array(updateWebhookSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type WebhookListQuery = z.infer<typeof webhookListQuerySchema>;
export type BatchWebhooksInput = z.infer<typeof batchWebhooksSchema>;
