/**
 * Product Variations Routes
 */

import { Hono } from 'hono';
import { 
  variationListQuerySchema, 
  createVariationSchema, 
  updateVariationSchema,
  batchVariationsSchema 
} from '../validators/variation.validators';
import { variationService } from '../services/variation.service';
import { productService } from '../services/product.service';
import { formatVariationResponse, formatVariationListResponse } from '../lib/variation-formatter';
import { setPaginationHeaders } from '../lib/wc-response';
import { wcError, WcErrorCodes } from '../lib/wc-error';

const router = new Hono({ strict: false });

/**
 * GET /products/:id/variations - List variations for a product
 */
router.get('/', async (c) => {
  const productId = parseInt(c.req.param('productId') || c.req.param('id'), 10);
  if (isNaN(productId) || productId <= 0) {
    return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 400), 400);
  }
  
  // Check product exists
  const product = await productService.get(productId);
  if (!product) {
    return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 404), 404);
  }
  
  const query = variationListQuerySchema.parse(c.req.query());
  const result = await variationService.list(productId, query);
  
  // Get attributes for each variation
  const attributesMap = new Map<number, Array<{ name: string; option: string }>>();
  for (const v of result.items) {
    const attrs = await variationService.getAttributes(v.id);
    attributesMap.set(v.id, attrs);
  }
  
  setPaginationHeaders(c, {
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.page,
    perPage: result.perPage,
  }, `/wp-json/wc/v3/products/${productId}/variations`);
  
  return c.json(formatVariationListResponse(result.items, productId, attributesMap));
});

/**
 * POST /products/:id/variations - Create a variation
 */
router.post('/', async (c) => {
  const productId = parseInt(c.req.param('productId') || c.req.param('id'), 10);
  if (isNaN(productId) || productId <= 0) {
    return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 400), 400);
  }
  
  // Check product exists
  const product = await productService.get(productId);
  if (!product) {
    return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 404), 404);
  }
  
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createVariationSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  // Check for duplicate SKU
  if (parseResult.data.sku) {
    const existingSku = await variationService.getBySku(parseResult.data.sku);
    if (existingSku) {
      return c.json(wcError(WcErrorCodes.PRODUCT_SKU_EXISTS, 'SKU already exists.', 400), 400);
    }
  }
  
  const variation = await variationService.create(productId, parseResult.data);
  const attributes = await variationService.getAttributes(variation.id);
  
  return c.json(formatVariationResponse(variation, productId, attributes), 201);
});

/**
 * GET /products/:id/variations/:variation_id - Get a variation
 */
router.get('/:variation_id', async (c) => {
  const productId = parseInt(c.req.param('productId') || c.req.param('id'), 10);
  const variationId = parseInt(c.req.param('variation_id'), 10);
  
  if (isNaN(productId) || productId <= 0 || isNaN(variationId) || variationId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  }
  
  const variation = await variationService.get(productId, variationId);
  if (!variation) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid variation ID.', 404), 404);
  }
  
  const attributes = await variationService.getAttributes(variationId);
  return c.json(formatVariationResponse(variation, productId, attributes));
});

/**
 * PUT /products/:id/variations/:variation_id - Update a variation
 */
router.put('/:variation_id', async (c) => {
  const productId = parseInt(c.req.param('productId') || c.req.param('id'), 10);
  const variationId = parseInt(c.req.param('variation_id'), 10);
  
  if (isNaN(productId) || productId <= 0 || isNaN(variationId) || variationId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  }
  
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = updateVariationSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  // Check for duplicate SKU if updating
  if (parseResult.data.sku) {
    const existingSku = await variationService.getBySku(parseResult.data.sku);
    if (existingSku && existingSku.id !== variationId) {
      return c.json(wcError(WcErrorCodes.PRODUCT_SKU_EXISTS, 'SKU already exists.', 400), 400);
    }
  }
  
  const variation = await variationService.update(productId, variationId, parseResult.data);
  if (!variation) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid variation ID.', 404), 404);
  }
  
  const attributes = await variationService.getAttributes(variationId);
  return c.json(formatVariationResponse(variation, productId, attributes));
});

/**
 * DELETE /products/:id/variations/:variation_id - Delete a variation
 */
router.delete('/:variation_id', async (c) => {
  const productId = parseInt(c.req.param('productId') || c.req.param('id'), 10);
  const variationId = parseInt(c.req.param('variation_id'), 10);
  
  if (isNaN(productId) || productId <= 0 || isNaN(variationId) || variationId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  }
  
  const force = c.req.query('force') === 'true';
  const variation = await variationService.delete(productId, variationId, force);
  
  if (!variation) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid variation ID.', 404), 404);
  }
  
  const attributes = await variationService.getAttributes(variationId);
  return c.json({
    ...formatVariationResponse(variation, productId, attributes),
    message: force ? 'Permanently deleted variation.' : 'Moved variation to trash.',
  });
});

/**
 * POST /products/:id/variations/batch - Batch operations
 */
router.post('/batch', async (c) => {
  const productId = parseInt(c.req.param('productId') || c.req.param('id'), 10);
  if (isNaN(productId) || productId <= 0) {
    return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 400), 400);
  }
  
  // Check product exists
  const product = await productService.get(productId);
  if (!product) {
    return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 404), 404);
  }
  
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = batchVariationsSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const { create, update, delete: deleteIds } = parseResult.data;
  
  const result = {
    create: [] as ReturnType<typeof formatVariationResponse>[],
    update: [] as ReturnType<typeof formatVariationResponse>[],
    delete: [] as ReturnType<typeof formatVariationResponse>[],
  };
  
  if (create && create.length > 0) {
    for (const input of create) {
      const variation = await variationService.create(productId, input);
      const attrs = await variationService.getAttributes(variation.id);
      result.create.push(formatVariationResponse(variation, productId, attrs));
    }
  }
  
  if (update && update.length > 0) {
    for (const input of update) {
      const variation = await variationService.update(productId, input.id, input);
      if (variation) {
        const attrs = await variationService.getAttributes(variation.id);
        result.update.push(formatVariationResponse(variation, productId, attrs));
      }
    }
  }
  
  if (deleteIds && deleteIds.length > 0) {
    for (const id of deleteIds) {
      const variation = await variationService.delete(productId, id);
      if (variation) {
        const attrs = await variationService.getAttributes(variation.id);
        result.delete.push(formatVariationResponse(variation, productId, attrs));
      }
    }
  }
  
  return c.json(result);
});

export default router;
