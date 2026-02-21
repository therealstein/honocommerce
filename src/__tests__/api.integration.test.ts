/**
 * API Integration Tests
 * Full HTTP request/response flow tests using Hono testing
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../index';
import { db } from '../db';
import { products } from '../db/schema/products';
import { coupons } from '../db/schema/coupons';
import { orders, orderItems, orderCouponLines, orderRefunds } from '../db/schema/orders';
import { sql } from 'drizzle-orm';

// Test credentials
const TEST_AUTH = {
  consumer_key: 'ck_test1234567890123456789012345678901234',
  consumer_secret: 'cs_testsecret098765432109876543210987654321',
};

// Helper to create Basic Auth header
const authHeader = () => {
  const credentials = btoa(`${TEST_AUTH.consumer_key}:${TEST_AUTH.consumer_secret}`);
  return { Authorization: `Basic ${credentials}` };
};

const ts = Date.now();
const uniqueSku = (prefix: string) => `${prefix}-${ts}-${Math.random().toString(36).slice(7)}`;
const uniqueCode = (prefix: string) => `${prefix}-${ts}-${Math.random().toString(36).slice(7)}`;

describe('API Integration Tests', () => {
  
  beforeAll(async () => {
    // Clean up test data
    await db.delete(orderItems).where(sql`1=1`);
    await db.delete(orderCouponLines).where(sql`1=1`);
    await db.delete(orderRefunds).where(sql`1=1`);
    await db.delete(orders).where(sql`1=1`);
    await db.delete(products).where(sql`${products.sku} LIKE 'TEST-API-%'`);
    await db.delete(coupons).where(sql`${coupons.code} LIKE 'TEST-API-%'`);
  });

  afterAll(async () => {
    await db.delete(orderItems).where(sql`1=1`);
    await db.delete(orderCouponLines).where(sql`1=1`);
    await db.delete(orderRefunds).where(sql`1=1`);
    await db.delete(orders).where(sql`1=1`);
    await db.delete(products).where(sql`${products.sku} LIKE 'TEST-API-%'`);
    await db.delete(coupons).where(sql`${coupons.code} LIKE 'TEST-API-%'`);
  });

  describe('Health Check', () => {
    
    it('should return health status with queue info', async () => {
      const res = await app.request('/health');
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.queue).toBeDefined();
      expect(body.queue.enabled).toBe(true);
      expect(['redis', 'memory']).toContain(body.queue.backend);
    });
  });

  describe('Product API', () => {
    
    it('should create a product via API', async () => {
      const res = await app.request('/wp-json/wc/v3/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          name: 'API Test Product',
          type: 'simple',
          status: 'publish',
          regular_price: '19.99',
          sku: uniqueSku('TEST-API-PROD'),
          manage_stock: true,
          stock_quantity: 50,
        }),
      });

      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.name).toBe('API Test Product');
      expect(body.price).toBe('19.99');
      expect(body.stock_quantity).toBe(50);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await app.request('/wp-json/wc/v3/products', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });

    it('should return WooCommerce-compatible error format', async () => {
      const res = await app.request('/wp-json/wc/v3/products/9999999', {
        method: 'GET',
        headers: authHeader(),
      });

      expect(res.status).toBe(404);
      
      const body = await res.json();
      expect(body.code).toBe('woocommerce_rest_product_invalid_id');
      expect(body.message).toBeDefined();
      expect(body.data.status).toBe(404);
    });
  });

  describe('Coupon API', () => {
    
    it('should create a percentage coupon', async () => {
      const res = await app.request('/wp-json/wc/v3/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          code: uniqueCode('TEST-API-PERCENT'),
          amount: '15.00',
          discount_type: 'percent',
          description: '15% off test coupon',
        }),
      });

      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.code).toContain('TEST-API-PERCENT');
      expect(body.discount_type).toBe('percent');
      expect(body.amount).toBe('15.00');
    });

    it('should create a fixed cart coupon', async () => {
      const res = await app.request('/wp-json/wc/v3/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          code: uniqueCode('TEST-API-FIXED'),
          amount: '10.00',
          discount_type: 'fixed_cart',
        }),
      });

      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.discount_type).toBe('fixed_cart');
    });
  });

  describe('Order API', () => {
    
    it('should create order with line items', async () => {
      // First create a product
      const productRes = await app.request('/wp-json/wc/v3/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          name: 'Order Test Product',
          type: 'simple',
          status: 'publish',
          regular_price: '25.00',
          sku: uniqueSku('TEST-API-ORD'),
        }),
      });
      
      const product = await productRes.json();

      // Create order
      const res = await app.request('/wp-json/wc/v3/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          status: 'pending',
          currency: 'EUR',
          line_items: [
            {
              product_id: product.id,
              quantity: 2,
              total: '50.00',
            },
          ],
          billing: {
            first_name: 'API',
            last_name: 'Test',
            email: 'api@test-api.test',
            country: 'DE',
          },
        }),
      });

      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.status).toBe('pending');
      expect(body.total).toBe('50.00');
      expect(body.currency).toBe('EUR');
      expect(body.currency_symbol).toBe('€');
      expect(body.line_items.length).toBe(1);
      expect(body.line_items[0].quantity).toBe(2);
    });

    it('should create order with coupon and shipping', async () => {
      // Create product
      const productRes = await app.request('/wp-json/wc/v3/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          name: 'Coupon Test Product',
          type: 'simple',
          status: 'publish',
          regular_price: '100.00',
          sku: uniqueSku('TEST-API-COUPORD'),
        }),
      });
      const product = await productRes.json();

      // Create coupon
      const couponRes = await app.request('/wp-json/wc/v3/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          code: uniqueCode('TEST-API-ORDCOUP'),
          amount: '10.00',
          discount_type: 'percent',
        }),
      });
      const coupon = await couponRes.json();

      // Create order with coupon and shipping
      // €100 - 10% (€10) + €5 shipping = €95
      const res = await app.request('/wp-json/wc/v3/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          status: 'pending',
          currency: 'EUR',
          line_items: [
            {
              product_id: product.id,
              quantity: 1,
              total: '100.00',
            },
          ],
          coupon_lines: [
            {
              code: coupon.code,
              discount: '10.00',
            },
          ],
          shipping_lines: [
            {
              method_title: 'Express Shipping',
              method_id: 'flat_rate',
              total: '5.00',
            },
          ],
          billing: {
            first_name: 'Full',
            last_name: 'Order',
            email: 'full@test-api.test',
          },
        }),
      });

      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.discount_total).toBe('10.00');
      expect(body.shipping_total).toBe('5.00');
      expect(body.total).toBe('95.00');
      expect(body.coupon_lines.length).toBe(1);
      expect(body.shipping_lines.length).toBe(1);
    });

    it('should accept non-existent product ID', async () => {
      const res = await app.request('/wp-json/wc/v3/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          status: 'pending',
          currency: 'EUR',
          line_items: [
            {
              product_id: 9999999,
              name: 'Custom Item',
              quantity: 1,
              total: '15.00',
            },
          ],
          billing: {
            first_name: 'Custom',
            last_name: 'Item',
            email: 'custom@test-api.test',
          },
        }),
      });

      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.line_items[0].name).toBe('Custom Item');
      expect(body.line_items[0].product_id).toBe(9999999);
    });

    it('should update order status', async () => {
      // Create order
      const createRes = await app.request('/wp-json/wc/v3/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          status: 'pending',
          currency: 'EUR',
          line_items: [
            {
              product_id: 1, // Use any ID
              name: 'Status Test',
              quantity: 1,
              total: '10.00',
            },
          ],
          billing: {
            first_name: 'Status',
            last_name: 'Update',
            email: 'status@test-api.test',
          },
        }),
      });
      const order = await createRes.json();

      // Update to completed
      const res = await app.request(`/wp-json/wc/v3/orders/${order.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          status: 'completed',
        }),
      });

      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.status).toBe('completed');
      expect(body.date_completed).toBeDefined();
    });
  });

  describe('Pagination', () => {
    
    it('should return pagination headers on list endpoints', async () => {
      const res = await app.request('/wp-json/wc/v3/products?per_page=5', {
        method: 'GET',
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      
      // Check pagination headers
      expect(res.headers.get('X-WP-Total')).toBeDefined();
      expect(res.headers.get('X-WP-TotalPages')).toBeDefined();
      
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('Reports API', () => {
    
    it('should return available reports', async () => {
      const res = await app.request('/wp-json/wc/v3/reports', {
        method: 'GET',
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      
      const slugs = body.map((r: any) => r.slug);
      expect(slugs).toContain('sales');
      expect(slugs).toContain('top_sellers');
      expect(slugs).toContain('orders_totals');
    });

    it('should return sales report', async () => {
      const res = await app.request('/wp-json/wc/v3/reports/sales', {
        method: 'GET',
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body[0].total_sales).toBeDefined();
      expect(body[0].total_orders).toBeDefined();
    });
  });
});
