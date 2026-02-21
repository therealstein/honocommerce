/**
 * Data Export/Import Routes
 * WooCommerce-compatible data API endpoints
 */

import { Hono } from 'hono';
import { exportService } from '../services/export.service';
import { importService } from '../services/import.service';
import { csvResponseHeaders } from '../lib/csv-utils';
import { wcError } from '../lib/wc-error';
import { z } from 'zod';

const router = new Hono();

// ============== EXPORT QUERY VALIDATORS ==============

const ExportQuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  category: z.coerce.number().optional(),
  customer: z.coerce.number().optional(),
  role: z.string().optional(),
  date_min: z.string().optional(),
  date_max: z.string().optional(),
});

const ImportOptionsSchema = z.object({
  update_existing: z.coerce.boolean().optional(),
  skip_errors: z.coerce.boolean().optional(),
});

// ============== PRODUCT EXPORT/IMPORT ==============

/**
 * GET /products/export
 * Export products to CSV
 */
router.get('/products/export', async (c) => {
  const query = ExportQuerySchema.safeParse(c.req.query());
  
  if (!query.success) {
    return c.json(wcError(
      'woocommerce_rest_invalid_param',
      'Invalid query parameter.',
      400
    ), 400);
  }

  const { status, category, date_min, date_max } = query.data;
  
  const csv = await exportService.products({
    status,
    category,
    dateMin: date_min,
    dateMax: date_max,
  });

  const filename = `products-${new Date().toISOString().split('T')[0]}.csv`;
  
  return new Response(csv, {
    headers: {
      ...csvResponseHeaders(filename),
    },
  });
});

/**
 * POST /products/import
 * Import products from CSV
 */
router.post('/products/import', async (c) => {
  const contentType = c.req.header('Content-Type') ?? '';
  
  // Check if CSV data is provided
  if (!contentType.includes('text/csv') && !contentType.includes('multipart/form-data')) {
    return c.json(wcError(
      'woocommerce_rest_invalid_content_type',
      'Content-Type must be text/csv or multipart/form-data.',
      400
    ), 400);
  }

  const query = ImportOptionsSchema.safeParse(c.req.query());
  const options = query.success ? query.data : {};

  try {
    const csvData = await c.req.text();
    
    if (!csvData.trim()) {
      return c.json(wcError(
        'woocommerce_rest_empty_csv',
        'CSV data is empty.',
        400
      ), 400);
    }

    const result = await importService.products(csvData, {
      updateExisting: options.update_existing ?? false,
      skipErrors: options.skip_errors ?? true,
    });

    return c.json({
      success: true,
      message: `Import complete. Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}, Skipped: ${result.skipped}`,
      data: result,
    });
  } catch (error) {
    return c.json(wcError(
      'woocommerce_rest_import_error',
      error instanceof Error ? error.message : 'Import failed.',
      500
    ), 500);
  }
});

// ============== ORDER EXPORT ==============

/**
 * GET /orders/export
 * Export orders to CSV
 */
router.get('/orders/export', async (c) => {
  const query = ExportQuerySchema.safeParse(c.req.query());
  
  if (!query.success) {
    return c.json(wcError(
      'woocommerce_rest_invalid_param',
      'Invalid query parameter.',
      400
    ), 400);
  }

  const { status, customer, date_min, date_max } = query.data;
  
  const csv = await exportService.orders({
    status,
    customer,
    dateMin: date_min,
    dateMax: date_max,
  });

  const filename = `orders-${new Date().toISOString().split('T')[0]}.csv`;
  
  return new Response(csv, {
    headers: {
      ...csvResponseHeaders(filename),
    },
  });
});

// ============== CUSTOMER EXPORT/IMPORT ==============

/**
 * GET /customers/export
 * Export customers to CSV
 */
router.get('/customers/export', async (c) => {
  const query = ExportQuerySchema.safeParse(c.req.query());
  
  if (!query.success) {
    return c.json(wcError(
      'woocommerce_rest_invalid_param',
      'Invalid query parameter.',
      400
    ), 400);
  }

  const { role, date_min, date_max } = query.data;
  
  const csv = await exportService.customers({
    role,
    dateMin: date_min,
    dateMax: date_max,
  });

  const filename = `customers-${new Date().toISOString().split('T')[0]}.csv`;
  
  return new Response(csv, {
    headers: {
      ...csvResponseHeaders(filename),
    },
  });
});

/**
 * POST /customers/import
 * Import customers from CSV
 */
router.post('/customers/import', async (c) => {
  const contentType = c.req.header('Content-Type') ?? '';
  
  if (!contentType.includes('text/csv') && !contentType.includes('multipart/form-data')) {
    return c.json(wcError(
      'woocommerce_rest_invalid_content_type',
      'Content-Type must be text/csv or multipart/form-data.',
      400
    ), 400);
  }

  const query = ImportOptionsSchema.safeParse(c.req.query());
  const options = query.success ? query.data : {};

  try {
    const csvData = await c.req.text();
    
    if (!csvData.trim()) {
      return c.json(wcError(
        'woocommerce_rest_empty_csv',
        'CSV data is empty.',
        400
      ), 400);
    }

    const result = await importService.customers(csvData, {
      updateExisting: options.update_existing ?? false,
      skipErrors: options.skip_errors ?? true,
    });

    return c.json({
      success: true,
      message: `Import complete. Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}, Skipped: ${result.skipped}`,
      data: result,
    });
  } catch (error) {
    return c.json(wcError(
      'woocommerce_rest_import_error',
      error instanceof Error ? error.message : 'Import failed.',
      500
    ), 500);
  }
});

// ============== COUPON EXPORT ==============

/**
 * GET /coupons/export
 * Export coupons to CSV
 */
router.get('/coupons/export', async (c) => {
  const query = ExportQuerySchema.safeParse(c.req.query());
  
  if (!query.success) {
    return c.json(wcError(
      'woocommerce_rest_invalid_param',
      'Invalid query parameter.',
      400
    ), 400);
  }

  const { type, date_min, date_max } = query.data;
  
  const csv = await exportService.coupons({
    type,
    dateMin: date_min,
    dateMax: date_max,
  });

  const filename = `coupons-${new Date().toISOString().split('T')[0]}.csv`;
  
  return new Response(csv, {
    headers: {
      ...csvResponseHeaders(filename),
    },
  });
});

export default router;
