/**
 * Product Attributes Routes
 */

import { Hono } from 'hono';
import { 
  attributeListQuerySchema, 
  createAttributeSchema, 
  updateAttributeSchema,
  batchAttributesSchema,
  attributeTermListQuerySchema,
  createAttributeTermSchema,
  updateAttributeTermSchema,
  batchAttributeTermsSchema
} from '../validators/attribute.validators';
import { attributeService } from '../services/attribute.service';
import { formatAttributeResponse, formatAttributeListResponse, formatAttributeTermResponse, formatAttributeTermListResponse } from '../lib/attribute-formatter';
import { setPaginationHeaders } from '../lib/wc-response';
import { wcError, WcErrorCodes } from '../lib/wc-error';

const router = new Hono();

// ========== Attributes ==========

router.get('/', async (c) => {
  const query = attributeListQuerySchema.parse(c.req.query());
  const result = await attributeService.list(query);
  
  setPaginationHeaders(c, {
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.page,
    perPage: result.perPage,
  }, '/wp-json/wc/v3/products/attributes');
  
  return c.json(formatAttributeListResponse(result.items));
});

router.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createAttributeSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const attribute = await attributeService.create(parseResult.data);
  return c.json(formatAttributeResponse(attribute), 201);
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  }
  
  const attribute = await attributeService.get(id);
  if (!attribute) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  }
  
  return c.json(formatAttributeResponse(attribute));
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  }
  
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = updateAttributeSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const attribute = await attributeService.update(id, parseResult.data);
  if (!attribute) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  }
  
  return c.json(formatAttributeResponse(attribute));
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  }
  
  const force = c.req.query('force') === 'true';
  const attribute = await attributeService.delete(id, force);
  
  if (!attribute) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  }
  
  return c.json({
    ...formatAttributeResponse(attribute),
    message: force ? 'Permanently deleted attribute.' : 'Deleted attribute.',
  });
});

router.post('/batch', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = batchAttributesSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const { create, update, delete: deleteIds } = parseResult.data;
  
  const result = {
    create: [] as ReturnType<typeof formatAttributeResponse>[],
    update: [] as ReturnType<typeof formatAttributeResponse>[],
    delete: [] as ReturnType<typeof formatAttributeResponse>[],
  };
  
  if (create && create.length > 0) {
    for (const input of create) {
      const attribute = await attributeService.create(input);
      result.create.push(formatAttributeResponse(attribute));
    }
  }
  
  if (update && update.length > 0) {
    for (const input of update) {
      const attribute = await attributeService.update(input.id, input);
      if (attribute) result.update.push(formatAttributeResponse(attribute));
    }
  }
  
  if (deleteIds && deleteIds.length > 0) {
    for (const id of deleteIds) {
      const attribute = await attributeService.delete(id);
      if (attribute) result.delete.push(formatAttributeResponse(attribute));
    }
  }
  
  return c.json(result);
});

// ========== Attribute Terms ==========

router.get('/:id/terms', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  if (isNaN(attributeId) || attributeId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  }
  
  // Check attribute exists
  const attribute = await attributeService.get(attributeId);
  if (!attribute) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  }
  
  const query = attributeTermListQuerySchema.parse(c.req.query());
  const result = await attributeService.listTerms(attributeId, query);
  
  setPaginationHeaders(c, {
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.page,
    perPage: result.perPage,
  }, `/wp-json/wc/v3/products/attributes/${attributeId}/terms`);
  
  return c.json(formatAttributeTermListResponse(result.items, attributeId));
});

router.post('/:id/terms', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  if (isNaN(attributeId) || attributeId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  }
  
  // Check attribute exists
  const attribute = await attributeService.get(attributeId);
  if (!attribute) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  }
  
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createAttributeTermSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const term = await attributeService.createTerm(attributeId, parseResult.data);
  return c.json(formatAttributeTermResponse(term, attributeId), 201);
});

router.get('/:id/terms/:term_id', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  const termId = parseInt(c.req.param('term_id'), 10);
  
  if (isNaN(attributeId) || attributeId <= 0 || isNaN(termId) || termId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  }
  
  const term = await attributeService.getTerm(attributeId, termId);
  if (!term) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid term ID.', 404), 404);
  }
  
  return c.json(formatAttributeTermResponse(term, attributeId));
});

router.put('/:id/terms/:term_id', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  const termId = parseInt(c.req.param('term_id'), 10);
  
  if (isNaN(attributeId) || attributeId <= 0 || isNaN(termId) || termId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  }
  
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = updateAttributeTermSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const term = await attributeService.updateTerm(attributeId, termId, parseResult.data);
  if (!term) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid term ID.', 404), 404);
  }
  
  return c.json(formatAttributeTermResponse(term, attributeId));
});

router.delete('/:id/terms/:term_id', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  const termId = parseInt(c.req.param('term_id'), 10);
  
  if (isNaN(attributeId) || attributeId <= 0 || isNaN(termId) || termId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  }
  
  const force = c.req.query('force') === 'true';
  const term = await attributeService.deleteTerm(attributeId, termId, force);
  
  if (!term) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid term ID.', 404), 404);
  }
  
  return c.json({
    ...formatAttributeTermResponse(term, attributeId),
    message: force ? 'Permanently deleted term.' : 'Deleted term.',
  });
});

router.post('/:id/terms/batch', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  if (isNaN(attributeId) || attributeId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  }
  
  // Check attribute exists
  const attribute = await attributeService.get(attributeId);
  if (!attribute) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  }
  
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = batchAttributeTermsSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const { create, update, delete: deleteIds } = parseResult.data;
  
  const result = {
    create: [] as ReturnType<typeof formatAttributeTermResponse>[],
    update: [] as ReturnType<typeof formatAttributeTermResponse>[],
    delete: [] as ReturnType<typeof formatAttributeTermResponse>[],
  };
  
  if (create && create.length > 0) {
    for (const input of create) {
      const term = await attributeService.createTerm(attributeId, input);
      result.create.push(formatAttributeTermResponse(term, attributeId));
    }
  }
  
  if (update && update.length > 0) {
    for (const input of update) {
      const term = await attributeService.updateTerm(attributeId, input.id, input);
      if (term) result.update.push(formatAttributeTermResponse(term, attributeId));
    }
  }
  
  if (deleteIds && deleteIds.length > 0) {
    for (const id of deleteIds) {
      const term = await attributeService.deleteTerm(attributeId, id);
      if (term) result.delete.push(formatAttributeTermResponse(term, attributeId));
    }
  }
  
  return c.json(result);
});

export default router;
