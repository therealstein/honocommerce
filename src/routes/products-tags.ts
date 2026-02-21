/**
 * Product Tags Routes
 */

import { Hono } from 'hono';
import { 
  tagListQuerySchema, 
  createTagSchema, 
  updateTagSchema,
  batchTagsSchema 
} from '../validators/tag.validators';
import { tagService } from '../services/tag.service';
import { formatTagResponse, formatTagListResponse } from '../lib/tag-formatter';
import { setPaginationHeaders } from '../lib/wc-response';
import { wcError, WcErrorCodes } from '../lib/wc-error';

const router = new Hono();

router.get('/', async (c) => {
  const query = tagListQuerySchema.parse(c.req.query());
  const result = await tagService.list(query);
  
  setPaginationHeaders(c, {
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.page,
    perPage: result.perPage,
  }, '/wp-json/wc/v3/products/tags');
  
  return c.json(formatTagListResponse(result.items));
});

router.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createTagSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const tag = await tagService.create(parseResult.data);
  return c.json(formatTagResponse(tag), 201);
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 400), 400);
  }
  
  const tag = await tagService.get(id);
  if (!tag) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 404), 404);
  }
  
  return c.json(formatTagResponse(tag));
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 400), 400);
  }
  
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = updateTagSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const tag = await tagService.update(id, parseResult.data);
  if (!tag) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 404), 404);
  }
  
  return c.json(formatTagResponse(tag));
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 400), 400);
  }
  
  const force = c.req.query('force') === 'true';
  const tag = await tagService.delete(id, force);
  
  if (!tag) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 404), 404);
  }
  
  return c.json({
    ...formatTagResponse(tag),
    message: force ? 'Permanently deleted tag.' : 'Deleted tag.',
  });
});

router.post('/batch', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = batchTagsSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const { create, update, delete: deleteIds } = parseResult.data;
  
  const result = {
    create: [] as ReturnType<typeof formatTagResponse>[],
    update: [] as ReturnType<typeof formatTagResponse>[],
    delete: [] as ReturnType<typeof formatTagResponse>[],
  };
  
  if (create && create.length > 0) {
    for (const input of create) {
      const tag = await tagService.create(input);
      result.create.push(formatTagResponse(tag));
    }
  }
  
  if (update && update.length > 0) {
    for (const input of update) {
      const tag = await tagService.update(input.id, input);
      if (tag) result.update.push(formatTagResponse(tag));
    }
  }
  
  if (deleteIds && deleteIds.length > 0) {
    for (const id of deleteIds) {
      const tag = await tagService.delete(id);
      if (tag) result.delete.push(formatTagResponse(tag));
    }
  }
  
  return c.json(result);
});

export default router;
