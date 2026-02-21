/**
 * Orders Routes
 * All order-related endpoints including refunds and notes
 */

import { Hono } from 'hono';
import { 
  orderListQuerySchema, 
  createOrderSchema, 
  updateOrderSchema, 
  batchOrdersSchema,
  createRefundSchema 
} from '../validators/order.validators';
import { 
  createOrderNoteSchema, 
  noteListQuerySchema 
} from '../validators/order-note.validators';
import { orderService } from '../services/order.service';
import { orderNoteService } from '../services/order-note.service';
import { formatOrderResponse, formatOrderListResponse, formatRefundResponse } from '../lib/order-formatter';
import { formatOrderNoteResponse, formatOrderNoteListResponse } from '../lib/order-note-formatter';
import { setPaginationHeaders } from '../lib/wc-response';
import { wcError, WcErrorCodes } from '../lib/wc-error';

const router = new Hono();

/**
 * GET /orders - List all orders
 */
router.get('/', async (c) => {
  const query = orderListQuerySchema.parse(c.req.query());
  const result = await orderService.list(query);
  
  setPaginationHeaders(c, {
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.page,
    perPage: result.perPage,
  }, '/wp-json/wc/v3/orders');
  
  return c.json(formatOrderListResponse(result.items));
});

/**
 * POST /orders - Create an order
 */
router.post('/', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createOrderSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const order = await orderService.create(parseResult.data);
  
  // Get related data
  const lineItems = await orderService.getItems(order.id);
  const shippingLines = await orderService.getShippingLines(order.id);
  const taxLines = await orderService.getTaxLines(order.id);
  const feeLines = await orderService.getFeeLines(order.id);
  const couponLines = await orderService.getCouponLines(order.id);
  const refunds = await orderService.getRefunds(order.id);
  
  return c.json(formatOrderResponse(order, { lineItems, shippingLines, taxLines, feeLines, couponLines, refunds }), 201);
});

/**
 * POST /orders/batch - Batch operations
 */
router.post('/batch', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = batchOrdersSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const { create, update, delete: deleteIds } = parseResult.data;
  
  const result = {
    create: [] as ReturnType<typeof formatOrderResponse>[],
    update: [] as ReturnType<typeof formatOrderResponse>[],
    delete: [] as ReturnType<typeof formatOrderResponse>[],
  };
  
  if (create?.length) {
    for (const input of create) {
      const order = await orderService.create(input);
      const lineItems = await orderService.getItems(order.id);
      result.create.push(formatOrderResponse(order, { lineItems }));
    }
  }
  
  if (update?.length) {
    for (const input of update) {
      const order = await orderService.update(input.id, input);
      if (order) {
        const lineItems = await orderService.getItems(order.id);
        result.update.push(formatOrderResponse(order, { lineItems }));
      }
    }
  }
  
  if (deleteIds?.length) {
    for (const id of deleteIds) {
      const order = await orderService.delete(id);
      if (order) result.delete.push(formatOrderResponse(order));
    }
  }
  
  return c.json(result);
});

/**
 * GET /orders/:id - Get an order
 */
router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 400), 400);
  }
  
  const order = await orderService.get(id);
  if (!order) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 404), 404);
  }
  
  // Get related data
  const lineItems = await orderService.getItems(id);
  const shippingLines = await orderService.getShippingLines(id);
  const taxLines = await orderService.getTaxLines(id);
  const feeLines = await orderService.getFeeLines(id);
  const couponLines = await orderService.getCouponLines(id);
  const refunds = await orderService.getRefunds(id);
  
  return c.json(formatOrderResponse(order, { lineItems, shippingLines, taxLines, feeLines, couponLines, refunds }));
});

/**
 * PUT /orders/:id - Update an order
 */
router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 400), 400);
  }
  
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = updateOrderSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const order = await orderService.update(id, parseResult.data);
  if (!order) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 404), 404);
  }
  
  // Get related data
  const lineItems = await orderService.getItems(id);
  const shippingLines = await orderService.getShippingLines(id);
  const taxLines = await orderService.getTaxLines(id);
  const feeLines = await orderService.getFeeLines(id);
  const couponLines = await orderService.getCouponLines(id);
  const refunds = await orderService.getRefunds(id);
  
  return c.json(formatOrderResponse(order, { lineItems, shippingLines, taxLines, feeLines, couponLines, refunds }));
});

/**
 * DELETE /orders/:id - Delete an order
 */
router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 400), 400);
  }
  
  const force = c.req.query('force') === 'true';
  const order = await orderService.delete(id, force);
  
  if (!order) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 404), 404);
  }
  
  return c.json({
    ...formatOrderResponse(order),
    message: force ? 'Permanently deleted order.' : 'Moved order to trash.',
  });
});

// ========== ORDER NOTES ==========

/**
 * GET /orders/:id/notes - List order notes
 */
router.get('/:id/notes', async (c) => {
  const orderId = parseInt(c.req.param('id'), 10);
  if (isNaN(orderId) || orderId <= 0) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 400), 400);
  }
  
  const order = await orderService.get(orderId);
  if (!order) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 404), 404);
  }
  
  const query = noteListQuerySchema.parse(c.req.query());
  const notes = await orderNoteService.list(orderId, query.type);
  
  return c.json(formatOrderNoteListResponse(notes, orderId));
});

/**
 * POST /orders/:id/notes - Create order note
 */
router.post('/:id/notes', async (c) => {
  const orderId = parseInt(c.req.param('id'), 10);
  if (isNaN(orderId) || orderId <= 0) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 400), 400);
  }
  
  const order = await orderService.get(orderId);
  if (!order) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 404), 404);
  }
  
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createOrderNoteSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const note = await orderNoteService.create(orderId, parseResult.data);
  
  return c.json(formatOrderNoteResponse(note, orderId), 201);
});

/**
 * GET /orders/:id/notes/:note_id - Get order note
 */
router.get('/:id/notes/:note_id', async (c) => {
  const orderId = parseInt(c.req.param('id'), 10);
  const noteId = parseInt(c.req.param('note_id'), 10);
  
  if (isNaN(orderId) || orderId <= 0 || isNaN(noteId) || noteId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  }
  
  const note = await orderNoteService.get(orderId, noteId);
  if (!note) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid note ID.', 404), 404);
  }
  
  return c.json(formatOrderNoteResponse(note, orderId));
});

/**
 * DELETE /orders/:id/notes/:note_id - Delete order note
 */
router.delete('/:id/notes/:note_id', async (c) => {
  const orderId = parseInt(c.req.param('id'), 10);
  const noteId = parseInt(c.req.param('note_id'), 10);
  
  if (isNaN(orderId) || orderId <= 0 || isNaN(noteId) || noteId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  }
  
  const deleted = await orderNoteService.delete(orderId, noteId);
  if (!deleted) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid note ID.', 404), 404);
  }
  
  return c.json({
    id: noteId,
    note: deleted.note,
    date_created: deleted.dateCreated.toISOString(),
    message: 'Deleted note.',
    _links: {
      self: [{ href: `/wp-json/wc/v3/orders/${orderId}/notes/${noteId}` }],
      collection: [{ href: `/wp-json/wc/v3/orders/${orderId}/notes` }],
    },
  });
});

// ========== REFUNDS ==========

/**
 * GET /orders/:id/refunds - List refunds
 */
router.get('/:id/refunds', async (c) => {
  const orderId = parseInt(c.req.param('id'), 10);
  if (isNaN(orderId) || orderId <= 0) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 400), 400);
  }
  
  const order = await orderService.get(orderId);
  if (!order) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 404), 404);
  }
  
  const refunds = await orderService.getRefunds(orderId);
  return c.json(refunds.map(formatRefundResponse));
});

/**
 * POST /orders/:id/refunds - Create refund
 */
router.post('/:id/refunds', async (c) => {
  const orderId = parseInt(c.req.param('id'), 10);
  if (isNaN(orderId) || orderId <= 0) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 400), 400);
  }
  
  const order = await orderService.get(orderId);
  if (!order) {
    return c.json(wcError(WcErrorCodes.ORDER_INVALID_ID, 'Invalid order ID.', 404), 404);
  }
  
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createRefundSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const refund = await orderService.createRefund(orderId, parseResult.data);
  return c.json(formatRefundResponse(refund), 201);
});

/**
 * GET /orders/:id/refunds/:refund_id - Get a refund
 */
router.get('/:id/refunds/:refund_id', async (c) => {
  const orderId = parseInt(c.req.param('id'), 10);
  const refundId = parseInt(c.req.param('refund_id'), 10);
  
  if (isNaN(orderId) || orderId <= 0 || isNaN(refundId) || refundId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  }
  
  const refund = await orderService.getRefund(orderId, refundId);
  if (!refund) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid refund ID.', 404), 404);
  }
  
  return c.json(formatRefundResponse(refund));
});

/**
 * DELETE /orders/:id/refunds/:refund_id - Delete a refund
 */
router.delete('/:id/refunds/:refund_id', async (c) => {
  const orderId = parseInt(c.req.param('id'), 10);
  const refundId = parseInt(c.req.param('refund_id'), 10);
  
  if (isNaN(orderId) || orderId <= 0 || isNaN(refundId) || refundId <= 0) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid ID.', 400), 400);
  }
  
  const refund = await orderService.deleteRefund(orderId, refundId);
  if (!refund) {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid refund ID.', 404), 404);
  }
  
  return c.json({
    ...formatRefundResponse(refund),
    message: 'Deleted refund.',
  });
});

export default router;
