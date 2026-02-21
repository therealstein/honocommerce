/**
 * Reports Routes
 * WooCommerce /reports endpoint handlers
 */

import { Hono } from 'hono';
import { reportService } from '../services/report.service';

const router = new Hono();

/**
 * GET /reports - List available reports
 */
router.get('/', async (c) => {
  return c.json([
    { slug: 'sales', description: 'List of sales reports.' },
    { slug: 'top_sellers', description: 'List of top sellers products.' },
    { slug: 'orders_totals', description: 'List of orders totals.' },
    { slug: 'products_totals', description: 'List of products totals.' },
    { slug: 'customers_totals', description: 'List of customers totals.' },
    { slug: 'coupons_totals', description: 'List of coupons totals.' },
    { slug: 'reviews_totals', description: 'List of reviews totals.' },
  ]);
});

/**
 * GET /reports/sales - Sales report
 */
router.get('/sales', async (c) => {
  const period = c.req.query('period') || 'week';
  const dateMin = c.req.query('date_min');
  const dateMax = c.req.query('date_max');
  
  const report = await reportService.getSalesReport(period, dateMin, dateMax);
  
  return c.json(report);
});

/**
 * GET /reports/top-sellers - Top sellers report
 */
router.get('/top-sellers', async (c) => {
  const period = c.req.query('period') || 'week';
  const dateMin = c.req.query('date_min');
  const dateMax = c.req.query('date_max');
  
  const report = await reportService.getTopSellersReport(period, dateMin, dateMax);
  
  return c.json(report);
});

/**
 * GET /reports/orders/totals - Orders totals
 */
router.get('/orders/totals', async (c) => {
  const report = await reportService.getOrdersTotals();
  return c.json(report);
});

/**
 * GET /reports/products/totals - Products totals
 */
router.get('/products/totals', async (c) => {
  const report = await reportService.getProductsTotals();
  return c.json(report);
});

/**
 * GET /reports/customers/totals - Customers totals
 */
router.get('/customers/totals', async (c) => {
  const report = await reportService.getCustomersTotals();
  return c.json(report);
});

/**
 * GET /reports/coupons/totals - Coupons totals
 */
router.get('/coupons/totals', async (c) => {
  const report = await reportService.getCouponsTotals();
  return c.json(report);
});

/**
 * GET /reports/reviews/totals - Reviews totals
 */
router.get('/reviews/totals', async (c) => {
  const report = await reportService.getReviewsTotals();
  return c.json(report);
});

export default router;
