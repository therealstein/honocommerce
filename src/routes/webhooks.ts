/**
 * Webhooks Routes
 * WooCommerce /webhooks endpoint handlers
 */

import { Hono } from 'hono';
import { webhookService } from '../services/webhook.service';
import { formatWebhookResponse, formatWebhookListResponse } from '../lib/webhook-formatter';
import { setPaginationHeaders } from '../lib/wc-response';
import { wcError } from '../lib/wc-error';
import {
  createWebhookSchema,
  updateWebhookSchema,
  webhookListQuerySchema,
  batchWebhooksSchema,
} from '../validators/webhook.validators';

const router = new Hono();

/**
 * GET /webhooks - List all webhooks
 */
router.get('/', async (c) => {
  const query = webhookListQuerySchema.parse(c.req.query());
  
  const result = await webhookService.list(query);
  
  setPaginationHeaders(c, result.total, result.totalPages);
  
  return c.json(formatWebhookListResponse(result.items));
});

/**
 * POST /webhooks - Create a webhook
 */
router.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createWebhookSchema.parse(body);
  
  const webhook = await webhookService.create(parsed);
  
  return c.json(formatWebhookResponse(webhook), 201);
});

/**
 * GET /webhooks/:id - Get a webhook
 */
router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json(wcError('webhook_invalid_id', 'Invalid webhook ID.', 400), 400);
  }
  
  const webhook = await webhookService.get(id);
  
  if (!webhook) {
    return c.json(wcError('webhook_invalid_id', 'Invalid webhook ID.', 404), 404);
  }
  
  return c.json(formatWebhookResponse(webhook));
});

/**
 * PUT /webhooks/:id - Update a webhook
 */
router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json(wcError('webhook_invalid_id', 'Invalid webhook ID.', 400), 400);
  }
  
  const body = await c.req.json();
  const parsed = updateWebhookSchema.parse(body);
  
  const webhook = await webhookService.update(id, parsed);
  
  if (!webhook) {
    return c.json(wcError('webhook_invalid_id', 'Invalid webhook ID.', 404), 404);
  }
  
  return c.json(formatWebhookResponse(webhook));
});

/**
 * DELETE /webhooks/:id - Delete a webhook
 */
router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json(wcError('webhook_invalid_id', 'Invalid webhook ID.', 400), 400);
  }
  
  const deleted = await webhookService.delete(id);
  
  if (!deleted) {
    return c.json(wcError('webhook_invalid_id', 'Invalid webhook ID.', 404), 404);
  }
  
  return c.json({ id });
});

/**
 * POST /webhooks/batch - Batch operations
 */
router.post('/batch', async (c) => {
  const body = await c.req.json();
  const parsed = batchWebhooksSchema.parse(body);
  
  const created: ReturnType<typeof formatWebhookResponse>[] = [];
  const updated: ReturnType<typeof formatWebhookResponse>[] = [];
  const deleted: number[] = [];
  
  // Process creates
  if (parsed.create) {
    for (const item of parsed.create) {
      const webhook = await webhookService.create(item);
      created.push(formatWebhookResponse(webhook));
    }
  }
  
  // Process updates
  if (parsed.update) {
    for (const item of parsed.update) {
      const webhook = await webhookService.update(item.id, item);
      if (webhook) {
        updated.push(formatWebhookResponse(webhook));
      }
    }
  }
  
  // Process deletes
  if (parsed.delete) {
    for (const id of parsed.delete) {
      const success = await webhookService.delete(id);
      if (success) {
        deleted.push(id);
      }
    }
  }
  
  return c.json({ create: created, update: updated, delete: deleted });
});

export default router;
