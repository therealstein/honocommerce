/**
 * Taxes Routes
 * WooCommerce /taxes endpoint handlers
 */

import { Hono } from 'hono';
import { taxService } from '../services/tax.service';
import {
  formatTaxRateResponse,
  formatTaxRateListResponse,
  formatTaxClassResponse,
  formatTaxClassListResponse,
} from '../lib/tax-formatter';
import { setPaginationHeaders } from '../lib/wc-response';
import { wcError } from '../lib/wc-error';
import {
  createTaxRateSchema,
  updateTaxRateSchema,
  taxRateListQuerySchema,
  batchTaxRatesSchema,
  createTaxClassSchema,
} from '../validators/tax.validators';

const router = new Hono();

// ============== TAX CLASSES (must come before /:id routes) ==============

/**
 * GET /taxes/classes - List tax classes
 */
router.get('/classes', async (c) => {
  const classes = await taxService.listClasses();
  
  return c.json(formatTaxClassListResponse(classes));
});

/**
 * POST /taxes/classes - Create tax class
 */
router.post('/classes', async (c) => {
  const body = await c.req.json();
  const parsed = createTaxClassSchema.parse(body);
  
  const taxClass = await taxService.createClass(parsed);
  
  return c.json(formatTaxClassResponse(taxClass), 201);
});

/**
 * DELETE /taxes/classes/:slug - Delete tax class
 */
router.delete('/classes/:slug', async (c) => {
  const slug = c.req.param('slug');
  
  const deleted = await taxService.deleteClass(slug);
  
  if (!deleted) {
    return c.json(wcError('tax_class_invalid_slug', 'Cannot delete this tax class.', 400), 400);
  }
  
  return c.json({ slug });
});

// ============== TAX RATES ==============

/**
 * GET /taxes - List tax rates
 */
router.get('/', async (c) => {
  const query = taxRateListQuerySchema.parse(c.req.query());
  
  const result = await taxService.listRates(query);
  
  setPaginationHeaders(c, result.total, result.totalPages);
  
  return c.json(formatTaxRateListResponse(result.items));
});

/**
 * POST /taxes - Create tax rate
 */
router.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createTaxRateSchema.parse(body);
  
  const rate = await taxService.createRate(parsed);
  
  return c.json(formatTaxRateResponse(rate), 201);
});

/**
 * GET /taxes/:id - Get tax rate
 */
router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json(wcError('tax_rate_invalid_id', 'Invalid tax rate ID.', 400), 400);
  }
  
  const rate = await taxService.getRate(id);
  
  if (!rate) {
    return c.json(wcError('tax_rate_invalid_id', 'Invalid tax rate ID.', 404), 404);
  }
  
  return c.json(formatTaxRateResponse(rate));
});

/**
 * PUT /taxes/:id - Update tax rate
 */
router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json(wcError('tax_rate_invalid_id', 'Invalid tax rate ID.', 400), 400);
  }
  
  const body = await c.req.json();
  const parsed = updateTaxRateSchema.parse(body);
  
  const rate = await taxService.updateRate(id, parsed);
  
  if (!rate) {
    return c.json(wcError('tax_rate_invalid_id', 'Invalid tax rate ID.', 404), 404);
  }
  
  return c.json(formatTaxRateResponse(rate));
});

/**
 * DELETE /taxes/:id - Delete tax rate
 */
router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json(wcError('tax_rate_invalid_id', 'Invalid tax rate ID.', 400), 400);
  }
  
  const deleted = await taxService.deleteRate(id);
  
  if (!deleted) {
    return c.json(wcError('tax_rate_invalid_id', 'Invalid tax rate ID.', 404), 404);
  }
  
  return c.json({ id });
});

/**
 * POST /taxes/batch - Batch operations
 */
router.post('/batch', async (c) => {
  const body = await c.req.json();
  const parsed = batchTaxRatesSchema.parse(body);
  
  const created: ReturnType<typeof formatTaxRateResponse>[] = [];
  const updated: ReturnType<typeof formatTaxRateResponse>[] = [];
  const deleted: number[] = [];
  
  // Process creates
  if (parsed.create) {
    for (const item of parsed.create) {
      const rate = await taxService.createRate(item);
      created.push(formatTaxRateResponse(rate));
    }
  }
  
  // Process updates
  if (parsed.update) {
    for (const item of parsed.update) {
      const rate = await taxService.updateRate(item.id, item);
      if (rate) {
        updated.push(formatTaxRateResponse(rate));
      }
    }
  }
  
  // Process deletes
  if (parsed.delete) {
    for (const id of parsed.delete) {
      const success = await taxService.deleteRate(id);
      if (success) {
        deleted.push(id);
      }
    }
  }
  
  return c.json({ create: created, update: updated, delete: deleted });
});

export default router;
