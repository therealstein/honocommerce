/**
 * Product Categories Routes
 */

import { Hono } from 'hono';
import { 
  categoryListQuerySchema, 
  createCategorySchema, 
  updateCategorySchema,
  batchCategoriesSchema 
} from '../validators/category.validators';
import { categoryService } from '../services/category.service';
import { formatCategoryResponse, formatCategoryListResponse } from '../lib/category-formatter';
import { setPaginationHeaders } from '../lib/wc-response';
import { wcError, WcErrorCodes } from '../lib/wc-error';

const router = new Hono();

/**
 * GET /products/categories - List all categories
 */
router.get('/', async (c) => {
  const query = categoryListQuerySchema.parse(c.req.query());
  const result = await categoryService.list(query);
  
  setPaginationHeaders(c, {
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.page,
    perPage: result.perPage,
  }, '/wp-json/wc/v3/products/categories');
  
  return c.json(formatCategoryListResponse(result.items));
});

/**
 * POST /products/categories - Create a category
 */
router.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createCategorySchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const category = await categoryService.create(parseResult.data);
  return c.json(formatCategoryResponse(category), 201);
});

/**
 * GET /products/categories/:id - Get a category
 */
router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 400), 400);
  }
  
  const category = await categoryService.get(id);
  if (!category) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 404), 404);
  }
  
  return c.json(formatCategoryResponse(category));
});

/**
 * PUT /products/categories/:id - Update a category
 */
router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 400), 400);
  }
  
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = updateCategorySchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const category = await categoryService.update(id, parseResult.data);
  if (!category) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 404), 404);
  }
  
  return c.json(formatCategoryResponse(category));
});

/**
 * DELETE /products/categories/:id - Delete a category
 */
router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 400), 400);
  }
  
  const force = c.req.query('force') === 'true';
  const category = await categoryService.delete(id, force);
  
  if (!category) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 404), 404);
  }
  
  return c.json({
    ...formatCategoryResponse(category),
    message: force ? 'Permanently deleted category.' : 'Deleted category.',
  });
});

/**
 * POST /products/categories/batch - Batch operations
 */
router.post('/batch', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = batchCategoriesSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const { create, update, delete: deleteIds } = parseResult.data;
  
  const result = {
    create: [] as ReturnType<typeof formatCategoryResponse>[],
    update: [] as ReturnType<typeof formatCategoryResponse>[],
    delete: [] as ReturnType<typeof formatCategoryResponse>[],
  };
  
  if (create && create.length > 0) {
    for (const input of create) {
      const category = await categoryService.create(input);
      result.create.push(formatCategoryResponse(category));
    }
  }
  
  if (update && update.length > 0) {
    for (const input of update) {
      const category = await categoryService.update(input.id, input);
      if (category) result.update.push(formatCategoryResponse(category));
    }
  }
  
  if (deleteIds && deleteIds.length > 0) {
    for (const id of deleteIds) {
      const category = await categoryService.delete(id);
      if (category) result.delete.push(formatCategoryResponse(category));
    }
  }
  
  return c.json(result);
});

export default router;
