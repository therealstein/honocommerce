/**
 * Customers Routes
 */

import { Hono } from 'hono';
import { customerListQuerySchema, createCustomerSchema, updateCustomerSchema, batchCustomersSchema } from '../validators/customer.validators';
import { customerService } from '../services/customer.service';
import { formatCustomerResponse, formatCustomerListResponse } from '../lib/customer-formatter';
import { setPaginationHeaders } from '../lib/wc-response';
import { wcError, WcErrorCodes } from '../lib/wc-error';

const router = new Hono();

router.get('/', async (c) => {
  const query = customerListQuerySchema.parse(c.req.query());
  const result = await customerService.list(query);
  
  setPaginationHeaders(c, {
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.page,
    perPage: result.perPage,
  }, '/wp-json/wc/v3/customers');
  
  return c.json(formatCustomerListResponse(result.items));
});

router.post('/', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = createCustomerSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  // Check for duplicate email
  const existing = await customerService.getByEmail(parseResult.data.email);
  if (existing) {
    return c.json(wcError(WcErrorCodes.CUSTOMER_EMAIL_EXISTS, 'Email already exists.', 400), 400);
  }
  
  const customer = await customerService.create(parseResult.data);
  return c.json(formatCustomerResponse(customer), 201);
});

router.post('/batch', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = batchCustomersSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  const { create, update, delete: deleteIds } = parseResult.data;
  const result = {
    create: [] as ReturnType<typeof formatCustomerResponse>[],
    update: [] as ReturnType<typeof formatCustomerResponse>[],
    delete: [] as ReturnType<typeof formatCustomerResponse>[],
  };
  
  if (create?.length) {
    for (const input of create) {
      const existing = await customerService.getByEmail(input.email);
      if (!existing) {
        const customer = await customerService.create(input);
        result.create.push(formatCustomerResponse(customer));
      }
    }
  }
  
  if (update?.length) {
    for (const input of update) {
      const customer = await customerService.update(input.id, input);
      if (customer) result.update.push(formatCustomerResponse(customer));
    }
  }
  
  if (deleteIds?.length) {
    for (const id of deleteIds) {
      const customer = await customerService.delete(id);
      if (customer) result.delete.push(formatCustomerResponse(customer));
    }
  }
  
  return c.json(result);
});

router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.CUSTOMER_INVALID_ID, 'Invalid customer ID.', 400), 400);
  }
  
  const customer = await customerService.get(id);
  if (!customer) {
    return c.json(wcError(WcErrorCodes.CUSTOMER_INVALID_ID, 'Invalid customer ID.', 404), 404);
  }
  
  return c.json(formatCustomerResponse(customer));
});

router.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.CUSTOMER_INVALID_ID, 'Invalid customer ID.', 400), 400);
  }
  
  let body: unknown;
  try { body = await c.req.json(); } catch {
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, 'Invalid JSON body.', 400), 400);
  }
  
  const parseResult = updateCustomerSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return c.json(wcError(WcErrorCodes.INVALID_PARAM, errors, 400), 400);
  }
  
  // Check for duplicate email if updating
  if (parseResult.data.email) {
    const existing = await customerService.getByEmail(parseResult.data.email);
    if (existing && existing.id !== id) {
      return c.json(wcError(WcErrorCodes.CUSTOMER_EMAIL_EXISTS, 'Email already exists.', 400), 400);
    }
  }
  
  const customer = await customerService.update(id, parseResult.data);
  if (!customer) {
    return c.json(wcError(WcErrorCodes.CUSTOMER_INVALID_ID, 'Invalid customer ID.', 404), 404);
  }
  
  return c.json(formatCustomerResponse(customer));
});

router.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.CUSTOMER_INVALID_ID, 'Invalid customer ID.', 400), 400);
  }
  
  const force = c.req.query('force') === 'true';
  const customer = await customerService.delete(id, force);
  
  if (!customer) {
    return c.json(wcError(WcErrorCodes.CUSTOMER_INVALID_ID, 'Invalid customer ID.', 404), 404);
  }
  
  return c.json({
    ...formatCustomerResponse(customer),
    message: force ? 'Permanently deleted customer.' : 'Deleted customer.',
  });
});

router.get('/:id/downloads', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id) || id <= 0) {
    return c.json(wcError(WcErrorCodes.CUSTOMER_INVALID_ID, 'Invalid customer ID.', 400), 400);
  }
  
  const customer = await customerService.get(id);
  if (!customer) {
    return c.json(wcError(WcErrorCodes.CUSTOMER_INVALID_ID, 'Invalid customer ID.', 404), 404);
  }
  
  // TODO: Get actual downloads from orders
  return c.json([]);
});

export default router;
