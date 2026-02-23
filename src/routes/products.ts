/**
 * Products Routes
 * All product-related endpoints including categories, tags, attributes, and variations
 */

import { Hono } from 'hono';
import { productListQuerySchema, createProductSchema, updateProductSchema, batchProductsSchema } from '../validators/product.validators';
import { categoryListQuerySchema, createCategorySchema, updateCategorySchema, batchCategoriesSchema } from '../validators/category.validators';
import { tagListQuerySchema, createTagSchema, updateTagSchema, batchTagsSchema } from '../validators/tag.validators';
import { attributeListQuerySchema, createAttributeSchema, updateAttributeSchema, batchAttributesSchema, attributeTermListQuerySchema, createAttributeTermSchema, updateAttributeTermSchema, batchAttributeTermsSchema } from '../validators/attribute.validators';
import { variationListQuerySchema, createVariationSchema, updateVariationSchema, batchVariationsSchema } from '../validators/variation.validators';

import { productService } from '../services/product.service';
import { categoryService } from '../services/category.service';
import { tagService } from '../services/tag.service';
import { attributeService } from '../services/attribute.service';
import { variationService } from '../services/variation.service';

import { formatProductResponse, formatProductListResponse } from '../lib/product-formatter';
import { formatCategoryResponse, formatCategoryListResponse } from '../lib/category-formatter';
import { formatTagResponse, formatTagListResponse } from '../lib/tag-formatter';
import { formatAttributeResponse, formatAttributeListResponse, formatAttributeTermResponse, formatAttributeTermListResponse } from '../lib/attribute-formatter';
import { formatVariationResponse, formatVariationListResponse } from '../lib/variation-formatter';

import { setPaginationHeaders } from '../lib/wc-response';
import { wcError, WcErrorCodes } from '../lib/wc-error';

const router = new Hono();

// ==================== PRODUCTS ====================

router.get('/', async (c) => {
  const query = productListQuerySchema.parse(c.req.query());
  const result = await productService.list(query);
  
  // Batch fetch related data (4 queries total, not N×4)
  const productIds = result.items.map(p => p.id);
  const [categoriesMap, tagsMap, imagesMap, variationsMap] = await Promise.all([
    productService.batchGetCategories(productIds),
    productService.batchGetTags(productIds),
    productService.batchGetImages(productIds),
    productService.batchGetVariationIds(productIds),
  ]);
  
  // Convert images to response format
  const formattedImagesMap = new Map(
    productIds.map(id => [
      id,
      (imagesMap.get(id) ?? []).map(img => ({
        id: img.id,
        date_created: img.dateCreated ? img.dateCreated.toISOString().replace('T', ' ').slice(0, 19) : null,
        date_created_gmt: img.dateCreated ? img.dateCreated.toISOString().slice(0, 19) + 'Z' : null,
        date_modified: null,
        date_modified_gmt: null,
        src: img.src,
        name: img.name,
        alt: img.alt,
      }))
    ])
  );
  
  setPaginationHeaders(c, {
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.page,
    perPage: result.perPage,
  }, '/wp-json/wc/v3/products');
  
  return c.json(formatProductListResponse(result.items, {
    categoriesMap,
    tagsMap,
    imagesMap: formattedImagesMap,
    variationsMap,
  }));
});

router.post('/', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createProductSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  if (parseResult.data.sku) {
    const existing = await productService.getBySku(parseResult.data.sku);
    if (existing) return c.json(wcError(WcErrorCodes.PRODUCT_SKU_EXISTS, 'SKU already exists.', 400), 400);
  }
  
  const product = await productService.create(parseResult.data);
  
  // Fetch related data for response
  const [categories, tags, images, variations] = await Promise.all([
    productService.getCategories(product.id),
    productService.getTags(product.id),
    productService.getImages(product.id),
    productService.getVariationIds(product.id),
  ]);
  
  const formattedImages = images.map(img => ({
    id: img.id,
    date_created: img.dateCreated ? img.dateCreated.toISOString().replace('T', ' ').slice(0, 19) : null,
    date_created_gmt: img.dateCreated ? img.dateCreated.toISOString().slice(0, 19) + 'Z' : null,
    date_modified: null,
    date_modified_gmt: null,
    src: img.src,
    name: img.name,
    alt: img.alt,
  }));
  
  return c.json(formatProductResponse(product, {
    categories,
    tags,
    images: formattedImages,
    variations,
  }), 201);
});

router.post('/batch', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = batchProductsSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const { create, update, delete: deleteIds } = parseResult.data;
  const result = { 
    create: [] as ReturnType<typeof formatProductResponse>[], 
    update: [] as typeof formatProductResponse extends (...args: any[]) => infer R ? R[] : never, 
    delete: [] as typeof formatProductResponse extends (...args: any[]) => infer R ? R[] : never 
  };
  
  // Create products
  if (create?.length) {
    const created = await productService.batchCreate(create);
    const createdIds = created.map(p => p.id);
    
    // Batch fetch related data
    const [categoriesMap, tagsMap, imagesMap, variationsMap] = await Promise.all([
      productService.batchGetCategories(createdIds),
      productService.batchGetTags(createdIds),
      productService.batchGetImages(createdIds),
      productService.batchGetVariationIds(createdIds),
    ]);
    
    result.create = created.map(p => formatProductResponse(p, {
      categories: categoriesMap.get(p.id) ?? [],
      tags: tagsMap.get(p.id) ?? [],
      images: (imagesMap.get(p.id) ?? []).map(img => ({
        id: img.id,
        date_created: img.dateCreated ? img.dateCreated.toISOString().replace('T', ' ').slice(0, 19) : null,
        date_created_gmt: img.dateCreated ? img.dateCreated.toISOString().slice(0, 19) + 'Z' : null,
        date_modified: null,
        date_modified_gmt: null,
        src: img.src,
        name: img.name,
        alt: img.alt,
      })),
      variations: variationsMap.get(p.id) ?? [],
    }));
  }
  
  // Update products
  if (update?.length) {
    const updated = (await productService.batchUpdate(update)).filter((p): p is NonNullable<typeof p> => p !== null);
    const updatedIds = updated.map(p => p.id);
    
    // Batch fetch related data
    const [categoriesMap, tagsMap, imagesMap, variationsMap] = await Promise.all([
      productService.batchGetCategories(updatedIds),
      productService.batchGetTags(updatedIds),
      productService.batchGetImages(updatedIds),
      productService.batchGetVariationIds(updatedIds),
    ]);
    
    result.update = updated.map(p => formatProductResponse(p, {
      categories: categoriesMap.get(p.id) ?? [],
      tags: tagsMap.get(p.id) ?? [],
      images: (imagesMap.get(p.id) ?? []).map(img => ({
        id: img.id,
        date_created: img.dateCreated ? img.dateCreated.toISOString().replace('T', ' ').slice(0, 19) : null,
        date_created_gmt: img.dateCreated ? img.dateCreated.toISOString().slice(0, 19) + 'Z' : null,
        date_modified: null,
        date_modified_gmt: null,
        src: img.src,
        name: img.name,
        alt: img.alt,
      })),
      variations: variationsMap.get(p.id) ?? [],
    }));
  }
  
  // Delete products
  if (deleteIds?.length) {
    result.delete = (await productService.batchDelete(deleteIds))
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map(p => formatProductResponse(p));
  }
  
  return c.json(result);
});

// ==================== CATEGORIES ====================

router.get('/categories', async (c) => {
  const query = categoryListQuerySchema.parse(c.req.query());
  const result = await categoryService.list(query);
  
  setPaginationHeaders(c, { total: result.total, totalPages: result.totalPages, currentPage: result.page, perPage: result.perPage }, '/wp-json/wc/v3/products/categories');
  return c.json(formatCategoryListResponse(result.items));
});

router.post('/categories', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = createCategorySchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  return c.json(formatCategoryResponse(await categoryService.create(parseResult.data)), 201);
});

router.get('/categories/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 400), 400);
  
  const category = await categoryService.get(id);
  if (!category) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 404), 404);
  
  return c.json(formatCategoryResponse(category));
});

router.put('/categories/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 400), 400);
  
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = updateCategorySchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  const category = await categoryService.update(id, parseResult.data);
  if (!category) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 404), 404);
  
  return c.json(formatCategoryResponse(category));
});

router.delete('/categories/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 400), 400);
  
  const category = await categoryService.delete(id, c.req.query('force') === 'true');
  if (!category) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid category ID.', 404), 404);
  
  return c.json({ ...formatCategoryResponse(category), message: 'Deleted category.' });
});

router.post('/categories/batch', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = batchCategoriesSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  const { create, update, delete: deleteIds } = parseResult.data;
  const result = { create: [] as ReturnType<typeof formatCategoryResponse>[], update: [] as ReturnType<typeof formatCategoryResponse>[], delete: [] as ReturnType<typeof formatCategoryResponse>[] };
  
  if (create?.length) for (const input of create) result.create.push(formatCategoryResponse(await categoryService.create(input)));
  if (update?.length) for (const input of update) { const cat = await categoryService.update(input.id, input); if (cat) result.update.push(formatCategoryResponse(cat)); }
  if (deleteIds?.length) for (const id of deleteIds) { const cat = await categoryService.delete(id); if (cat) result.delete.push(formatCategoryResponse(cat)); }
  
  return c.json(result);
});

// ==================== TAGS ====================

router.get('/tags', async (c) => {
  const query = tagListQuerySchema.parse(c.req.query());
  const result = await tagService.list(query);
  
  setPaginationHeaders(c, { total: result.total, totalPages: result.totalPages, currentPage: result.page, perPage: result.perPage }, '/wp-json/wc/v3/products/tags');
  return c.json(formatTagListResponse(result.items));
});

router.post('/tags', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = createTagSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  return c.json(formatTagResponse(await tagService.create(parseResult.data)), 201);
});

router.get('/tags/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 400), 400);
  
  const tag = await tagService.get(id);
  if (!tag) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 404), 404);
  
  return c.json(formatTagResponse(tag));
});

router.put('/tags/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 400), 400);
  
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = updateTagSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  const tag = await tagService.update(id, parseResult.data);
  if (!tag) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 404), 404);
  
  return c.json(formatTagResponse(tag));
});

router.delete('/tags/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 400), 400);
  
  const tag = await tagService.delete(id, c.req.query('force') === 'true');
  if (!tag) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid tag ID.', 404), 404);
  
  return c.json({ ...formatTagResponse(tag), message: 'Deleted tag.' });
});

router.post('/tags/batch', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = batchTagsSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  const { create, update, delete: deleteIds } = parseResult.data;
  const result = { create: [] as ReturnType<typeof formatTagResponse>[], update: [] as ReturnType<typeof formatTagResponse>[], delete: [] as ReturnType<typeof formatTagResponse>[] };
  
  if (create?.length) for (const input of create) result.create.push(formatTagResponse(await tagService.create(input)));
  if (update?.length) for (const input of update) { const t = await tagService.update(input.id, input); if (t) result.update.push(formatTagResponse(t)); }
  if (deleteIds?.length) for (const id of deleteIds) { const t = await tagService.delete(id); if (t) result.delete.push(formatTagResponse(t)); }
  
  return c.json(result);
});

// ==================== ATTRIBUTES ====================

router.get('/attributes', async (c) => {
  const query = attributeListQuerySchema.parse(c.req.query());
  const result = await attributeService.list(query);
  
  setPaginationHeaders(c, { total: result.total, totalPages: result.totalPages, currentPage: result.page, perPage: result.perPage }, '/wp-json/wc/v3/products/attributes');
  return c.json(formatAttributeListResponse(result.items));
});

router.post('/attributes', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = createAttributeSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  return c.json(formatAttributeResponse(await attributeService.create(parseResult.data)), 201);
});

router.get('/attributes/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  
  const attribute = await attributeService.get(id);
  if (!attribute) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  
  return c.json(formatAttributeResponse(attribute));
});

router.put('/attributes/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = updateAttributeSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  const attribute = await attributeService.update(id, parseResult.data);
  if (!attribute) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  
  return c.json(formatAttributeResponse(attribute));
});

router.delete('/attributes/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  
  const attribute = await attributeService.delete(id, c.req.query('force') === 'true');
  if (!attribute) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  
  return c.json({ ...formatAttributeResponse(attribute), message: 'Deleted attribute.' });
});

router.post('/attributes/batch', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = batchAttributesSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  const { create, update, delete: deleteIds } = parseResult.data;
  const result = { create: [] as ReturnType<typeof formatAttributeResponse>[], update: [] as ReturnType<typeof formatAttributeResponse>[], delete: [] as ReturnType<typeof formatAttributeResponse>[] };
  
  if (create?.length) for (const input of create) result.create.push(formatAttributeResponse(await attributeService.create(input)));
  if (update?.length) for (const input of update) { const a = await attributeService.update(input.id, input); if (a) result.update.push(formatAttributeResponse(a)); }
  if (deleteIds?.length) for (const id of deleteIds) { const a = await attributeService.delete(id); if (a) result.delete.push(formatAttributeResponse(a)); }
  
  return c.json(result);
});

// ========== ATTRIBUTE TERMS ==========

router.get('/attributes/:id/terms', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  if (isNaN(attributeId) || attributeId <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  
  const attribute = await attributeService.get(attributeId);
  if (!attribute) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  
  const query = attributeTermListQuerySchema.parse(c.req.query());
  const result = await attributeService.listTerms(attributeId, query);
  
  setPaginationHeaders(c, { total: result.total, totalPages: result.totalPages, currentPage: result.page, perPage: result.perPage }, `/wp-json/wc/v3/products/attributes/${attributeId}/terms`);
  return c.json(formatAttributeTermListResponse(result.items, attributeId));
});

router.post('/attributes/:id/terms', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  if (isNaN(attributeId) || attributeId <= 0) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 400), 400);
  
  const attribute = await attributeService.get(attributeId);
  if (!attribute) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid attribute ID.', 404), 404);
  
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = createAttributeTermSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  const term = await attributeService.createTerm(attributeId, parseResult.data);
  return c.json(formatAttributeTermResponse(term, attributeId), 201);
});

router.get('/attributes/:id/terms/:term_id', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  const termId = parseInt(c.req.param('term_id'), 10);
  
  if (isNaN(attributeId) || isNaN(termId) || attributeId <= 0 || termId <= 0) 
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  
  const term = await attributeService.getTerm(attributeId, termId);
  if (!term) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid term ID.', 404), 404);
  
  return c.json(formatAttributeTermResponse(term, attributeId));
});

router.put('/attributes/:id/terms/:term_id', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  const termId = parseInt(c.req.param('term_id'), 10);
  
  if (isNaN(attributeId) || isNaN(termId) || attributeId <= 0 || termId <= 0) 
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = updateAttributeTermSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  const term = await attributeService.updateTerm(attributeId, termId, parseResult.data);
  if (!term) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid term ID.', 404), 404);
  
  return c.json(formatAttributeTermResponse(term, attributeId));
});

router.delete('/attributes/:id/terms/:term_id', async (c) => {
  const attributeId = parseInt(c.req.param('id'), 10);
  const termId = parseInt(c.req.param('term_id'), 10);
  
  if (isNaN(attributeId) || isNaN(termId) || attributeId <= 0 || termId <= 0) 
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  
  const term = await attributeService.deleteTerm(attributeId, termId, c.req.query('force') === 'true');
  if (!term) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid term ID.', 404), 404);
  
  return c.json({ ...formatAttributeTermResponse(term, attributeId), message: 'Deleted term.' });
});

// ==================== VARIATIONS ====================

router.get('/:id/variations', async (c) => {
  const productId = parseInt(c.req.param('id'), 10);
  if (isNaN(productId) || productId <= 0) return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 400), 400);
  
  const product = await productService.get(productId);
  if (!product) return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 404), 404);
  
  const query = variationListQuerySchema.parse(c.req.query());
  const result = await variationService.list(productId, query);
  
  const attrsMap = new Map<number, Array<{ name: string; option: string }>>();
  for (const v of result.items) {
    attrsMap.set(v.id, await variationService.getAttributes(v.id));
  }
  
  setPaginationHeaders(c, { total: result.total, totalPages: result.totalPages, currentPage: result.page, perPage: result.perPage }, `/wp-json/wc/v3/products/${productId}/variations`);
  return c.json(formatVariationListResponse(result.items, productId, attrsMap));
});

router.post('/:id/variations', async (c) => {
  const productId = parseInt(c.req.param('id'), 10);
  if (isNaN(productId) || productId <= 0) return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 400), 400);
  
  const product = await productService.get(productId);
  if (!product) return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 404), 404);
  
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = createVariationSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  if (parseResult.data.sku) {
    const existing = await variationService.getBySku(parseResult.data.sku);
    if (existing) return c.json(wcError(WcErrorCodes.PRODUCT_SKU_EXISTS, 'SKU already exists.', 400), 400);
  }
  
  const variation = await variationService.create(productId, parseResult.data);
  const attrs = await variationService.getAttributes(variation.id);
  return c.json(formatVariationResponse(variation, productId, attrs), 201);
});

router.get('/:id/variations/:variation_id', async (c) => {
  const productId = parseInt(c.req.param('id'), 10);
  const variationId = parseInt(c.req.param('variation_id'), 10);
  
  if (isNaN(productId) || isNaN(variationId) || productId <= 0 || variationId <= 0) 
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  
  const variation = await variationService.get(productId, variationId);
  if (!variation) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid variation ID.', 404), 404);
  
  const attrs = await variationService.getAttributes(variationId);
  return c.json(formatVariationResponse(variation, productId, attrs));
});

router.put('/:id/variations/:variation_id', async (c) => {
  const productId = parseInt(c.req.param('id'), 10);
  const variationId = parseInt(c.req.param('variation_id'), 10);
  
  if (isNaN(productId) || isNaN(variationId) || productId <= 0 || variationId <= 0) 
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = updateVariationSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  if (parseResult.data.sku) {
    const existing = await variationService.getBySku(parseResult.data.sku);
    if (existing && existing.id !== variationId) return c.json(wcError(WcErrorCodes.PRODUCT_SKU_EXISTS, 'SKU already exists.', 400), 400);
  }
  
  const variation = await variationService.update(productId, variationId, parseResult.data);
  if (!variation) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid variation ID.', 404), 404);
  
  const attrs = await variationService.getAttributes(variationId);
  return c.json(formatVariationResponse(variation, productId, attrs));
});

router.delete('/:id/variations/:variation_id', async (c) => {
  const productId = parseInt(c.req.param('id'), 10);
  const variationId = parseInt(c.req.param('variation_id'), 10);
  
  if (isNaN(productId) || isNaN(variationId) || productId <= 0 || variationId <= 0) 
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  
  const variation = await variationService.delete(productId, variationId, c.req.query('force') === 'true');
  if (!variation) return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid variation ID.', 404), 404);
  
  const attrs = await variationService.getAttributes(variationId);
  return c.json({ ...formatVariationResponse(variation, productId, attrs), message: 'Deleted variation.' });
});

// ==================== PRODUCTS (dynamic routes) ====================

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 400), 400);
  
  const product = await productService.get(id);
  if (!product) return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 404), 404);
  
  // Fetch related data
  const [categories, tags, images, variations] = await Promise.all([
    productService.getCategories(id),
    productService.getTags(id),
    productService.getImages(id),
    productService.getVariationIds(id),
  ]);
  
  const formattedImages = images.map(img => ({
    id: img.id,
    date_created: img.dateCreated ? img.dateCreated.toISOString().replace('T', ' ').slice(0, 19) : null,
    date_created_gmt: img.dateCreated ? img.dateCreated.toISOString().slice(0, 19) + 'Z' : null,
    date_modified: null,
    date_modified_gmt: null,
    src: img.src,
    name: img.name,
    alt: img.alt,
  }));
  
  return c.json(formatProductResponse(product, {
    categories,
    tags,
    images: formattedImages,
    variations,
  }));
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 400), 400);
  
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400); }
  
  const parseResult = updateProductSchema.safeParse(body);
  if (!parseResult.success) return c.json(wcError(WcErrorCodes.INVALID_PARAM, parseResult.error.issues.map(i => i.message).join('; '), 400), 400);
  
  if (parseResult.data.sku) {
    const existing = await productService.getBySku(parseResult.data.sku);
    if (existing && existing.id !== id) return c.json(wcError(WcErrorCodes.PRODUCT_SKU_EXISTS, 'SKU already exists.', 400), 400);
  }
  
  const product = await productService.update(id, parseResult.data);
  if (!product) return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 404), 404);
  
  // Fetch related data
  const [categories, tags, images, variations] = await Promise.all([
    productService.getCategories(id),
    productService.getTags(id),
    productService.getImages(id),
    productService.getVariationIds(id),
  ]);
  
  const formattedImages = images.map(img => ({
    id: img.id,
    date_created: img.dateCreated ? img.dateCreated.toISOString().replace('T', ' ').slice(0, 19) : null,
    date_created_gmt: img.dateCreated ? img.dateCreated.toISOString().slice(0, 19) + 'Z' : null,
    date_modified: null,
    date_modified_gmt: null,
    src: img.src,
    name: img.name,
    alt: img.alt,
  }));
  
  return c.json(formatProductResponse(product, {
    categories,
    tags,
    images: formattedImages,
    variations,
  }));
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 400), 400);
  
  const force = c.req.query('force') === 'true';
  const product = await productService.delete(id, force);
  if (!product) return c.json(wcError(WcErrorCodes.PRODUCT_INVALID_ID, 'Invalid product ID.', 404), 404);
  
  return c.json({ ...formatProductResponse(product), message: force ? 'Permanently deleted product.' : 'Moved product to trash.' });
});

export default router;
