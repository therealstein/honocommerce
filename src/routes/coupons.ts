/**
 * Coupons Routes
 */

import { Hono } from 'hono';
import { couponListQuerySchema, createCouponSchema, updateCouponSchema, batchCouponsSchema } from '../validators/coupon.validators';
import { couponService } from '../services/coupon.service';
import { formatCouponResponse, formatCouponListResponse } from '../lib/coupon-formatter';
import { setPaginationHeaders } from '../lib/wc-response';
import { wcError, WcErrorCodes } from '../lib/wc-error';

const router = new Hono();

router.get('/', async (c) => {
  const query = couponListQuerySchema.parse(c.req.query());
  const result = await couponService.list(query);
  
  setPaginationHeaders(c, {
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.page,
    perPage: result.perPage,
  }, '/wp-json/wc/v3/coupons');
  
  return c.json(formatCouponListResponse(result.items));
});

router.post('/', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createCouponSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  // Check for duplicate code
  const existing = await couponService.getByCode(parseResult.data.code);
  if (existing) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Coupon code already exists.', 400), 400);
  }
  
  const coupon = await couponService.create(parseResult.data);
  return c.json(formatCouponResponse(coupon), 201);
});

router.post('/batch', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = batchCouponsSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const { create, update, delete: deleteIds } = parseResult.data;
  const result = {
    create: [] as ReturnType<typeof formatCouponResponse>[],
    update: [] as ReturnType<typeof formatCouponResponse>[],
    delete: [] as ReturnType<typeof formatCouponResponse>[],
  };
  
  if (create?.length) {
    for (const input of create) {
      const existing = await couponService.getByCode(input.code);
      if (!existing) {
        const coupon = await couponService.create(input);
        result.create.push(formatCouponResponse(coupon));
      }
    }
  }
  
  if (update?.length) {
    for (const input of update) {
      const coupon = await couponService.update(input.id, input);
      if (coupon) result.update.push(formatCouponResponse(coupon));
    }
  }
  
  if (deleteIds?.length) {
    for (const id of deleteIds) {
      const coupon = await couponService.delete(id);
      if (coupon) result.delete.push(formatCouponResponse(coupon));
    }
  }
  
  return c.json(result);
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.COUPON_INVALID_ID, 'Invalid coupon ID.', 400), 400);
  }
  
  const coupon = await couponService.get(id);
  if (!coupon) {
    return c.json(wcError(WcErrorCodes.COUPON_INVALID_ID, 'Invalid coupon ID.', 404), 404);
  }
  
  return c.json(formatCouponResponse(coupon));
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.COUPON_INVALID_ID, 'Invalid coupon ID.', 400), 400);
  }
  
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = updateCouponSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  // Check for duplicate code if updating
  if (parseResult.data.code) {
    const existing = await couponService.getByCode(parseResult.data.code);
    if (existing && existing.id !== id) {
      return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Coupon code already exists.', 400), 400);
    }
  }
  
  const coupon = await couponService.update(id, parseResult.data);
  if (!coupon) {
    return c.json(wcError(WcErrorCodes.COUPON_INVALID_ID, 'Invalid coupon ID.', 404), 404);
  }
  
  return c.json(formatCouponResponse(coupon));
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.COUPON_INVALID_ID, 'Invalid coupon ID.', 400), 400);
  }
  
  const force = c.req.query('force') === 'true';
  const coupon = await couponService.delete(id, force);
  
  if (!coupon) {
    return c.json(wcError(WcErrorCodes.COUPON_INVALID_ID, 'Invalid coupon ID.', 404), 404);
  }
  
  return c.json({
    ...formatCouponResponse(coupon),
    message: force ? 'Permanently deleted coupon.' : 'Deleted coupon.',
  });
});

export default router;
