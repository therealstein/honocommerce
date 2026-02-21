/**
 * Order Flow Integration Tests
 * Tests the complete order lifecycle including:
 * - Order creation with products and coupons
 * - Order status changes
 * - Inventory management
 * - Coupon usage tracking
 * - Refunds
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../db';
import { products } from '../db/schema/products';
import { coupons } from '../db/schema/coupons';
import { orders, orderItems, orderCouponLines, orderRefunds } from '../db/schema/orders';
import { customers } from '../db/schema/customers';
import { sql, eq } from 'drizzle-orm';
import { productService } from '../services/product.service';
import { couponService } from '../services/coupon.service';
import { customerService } from '../services/customer.service';
import { 
  createOrder, 
  updateOrder, 
  getOrder, 
  createRefund,
  getOrderItems,
} from '../services/order.service';

const ts = Date.now();

// Helper to generate unique SKU
const uniqueSku = (prefix: string) => `${prefix}-${ts}-${Math.random().toString(36).slice(7)}`;

// Helper to generate unique coupon code
const uniqueCode = (prefix: string) => `${prefix}-${ts}-${Math.random().toString(36).slice(7)}`;

describe('Order Flow Integration Tests', () => {
  
  // Clean up test data before all tests
  beforeAll(async () => {
    await db.delete(orderItems).where(sql`1=1`);
    await db.delete(orderCouponLines).where(sql`1=1`);
    await db.delete(orderRefunds).where(sql`1=1`);
    await db.delete(orders).where(sql`1=1`);
    await db.delete(products).where(sql`${products.sku} LIKE 'TEST-FLOW-%'`);
    await db.delete(coupons).where(sql`${coupons.code} LIKE 'TEST-FLOW-%'`);
    await db.delete(customers).where(sql`${customers.email} LIKE '%@test-flow.test'`);
  });

  // Clean up after each test
  afterAll(async () => {
    await db.delete(orderItems).where(sql`1=1`);
    await db.delete(orderCouponLines).where(sql`1=1`);
    await db.delete(orderRefunds).where(sql`1=1`);
    await db.delete(orders).where(sql`1=1`);
    await db.delete(products).where(sql`${products.sku} LIKE 'TEST-FLOW-%'`);
    await db.delete(coupons).where(sql`${coupons.code} LIKE 'TEST-FLOW-%'`);
    await db.delete(customers).where(sql`${customers.email} LIKE '%@test-flow.test'`);
  });

  describe('Order Creation with Coupon', () => {
    
    it('should create order with product and apply 10% coupon discount', async () => {
      // 1. Create product (€10 shirt)
      const product = await productService.create({
        name: 'Test T-Shirt',
        type: 'simple',
        status: 'publish',
        regular_price: '10.00',
        sku: uniqueSku('TEST-FLOW-SHIRT'),
        manage_stock: true,
        stock_quantity: 100,
      });

      expect(product.id).toBeGreaterThan(0);
      expect(product.stockQuantity).toBe(100);

      // 2. Create 10% off coupon
      const coupon = await couponService.create({
        code: uniqueCode('TEST-FLOW-DISCOUNT10'),
        amount: '10.00',
        discount_type: 'percent',
        description: '10% off test coupon',
      });

      expect(coupon.id).toBeGreaterThan(0);
      expect(coupon.discountType).toBe('percent');

      // 3. Create order with 2 shirts (€20) + 10% discount (€2) = €18
      const order = await createOrder({
        status: 'pending',
        currency: 'EUR',
        line_items: [
          {
            product_id: product.id,
            quantity: 2,
            total: '20.00',
          },
        ],
        coupon_lines: [
          {
            code: coupon.code,
            discount: '2.00',
          },
        ],
        billing: {
          first_name: 'Test',
          last_name: 'Customer',
          email: 'test@test-flow.test',
          country: 'DE',
        },
      });

      expect(order.id).toBeGreaterThan(0);
      expect(order.status).toBe('pending');
      expect(order.total).toBe('18.00');
      expect(order.discountTotal).toBe('2.00');
      expect(order.currency).toBe('EUR');

      // 4. Verify line items
      const lineItems = await getOrderItems(order.id);
      expect(lineItems.length).toBe(1);
      expect(lineItems[0].productId).toBe(product.id);
      expect(lineItems[0].quantity).toBe(2);
      expect(lineItems[0].total).toBe('20.00');
    });

    it('should create order with shipping and calculate total correctly', async () => {
      // Create product
      const product = await productService.create({
        name: 'Test Product with Shipping',
        type: 'simple',
        status: 'publish',
        regular_price: '50.00',
        sku: uniqueSku('TEST-FLOW-SHIP'),
      });

      // Create order with shipping
      // €50 product + €5 shipping = €55 total
      const order = await createOrder({
        status: 'pending',
        currency: 'EUR',
        line_items: [
          {
            product_id: product.id,
            quantity: 1,
            total: '50.00',
          },
        ],
        shipping_lines: [
          {
            method_title: 'Flat Rate',
            method_id: 'flat_rate',
            total: '5.00',
          },
        ],
        billing: {
          first_name: 'Shipping',
          last_name: 'Test',
          email: 'shipping@test-flow.test',
          country: 'DE',
        },
      });

      expect(order.total).toBe('55.00');
      expect(order.shippingTotal).toBe('5.00');
    });
  });

  describe('Non-Existent Product Handling', () => {
    
    it('should accept order with non-existent product ID (WooCommerce behavior)', async () => {
      // Create order with product ID that doesn't exist
      const order = await createOrder({
        status: 'pending',
        currency: 'EUR',
        line_items: [
          {
            product_id: 999999, // Non-existent
            name: 'Custom Ball',
            quantity: 1,
            total: '10.00',
          },
        ],
        billing: {
          first_name: 'Custom',
          last_name: 'Product',
          email: 'custom@test-flow.test',
        },
      });

      expect(order.id).toBeGreaterThan(0);
      expect(order.total).toBe('10.00');

      // Verify line item has the provided name
      const lineItems = await getOrderItems(order.id);
      expect(lineItems.length).toBe(1);
      expect(lineItems[0].name).toBe('Custom Ball');
      expect(lineItems[0].productId).toBe(999999);
    });

    it('should apply coupon to order with non-existent product', async () => {
      // Create coupon
      const coupon = await couponService.create({
        code: uniqueCode('TEST-FLOW-CUSTOM'),
        amount: '10.00',
        discount_type: 'percent',
      });

      // Create order with non-existent product + coupon
      // €10 - 10% (€1) = €9
      const order = await createOrder({
        status: 'pending',
        currency: 'EUR',
        line_items: [
          {
            product_id: 888888,
            name: 'Custom Item',
            quantity: 1,
            total: '10.00',
          },
        ],
        coupon_lines: [
          {
            code: coupon.code,
            discount: '1.00',
          },
        ],
        billing: {
          first_name: 'Coupon',
          last_name: 'Test',
          email: 'coupon@test-flow.test',
        },
      });

      expect(order.total).toBe('9.00');
      expect(order.discountTotal).toBe('1.00');
    });
  });

  describe('Order Status Changes', () => {
    
    it('should change order status from pending to completed', async () => {
      const product = await productService.create({
        name: 'Status Test Product',
        type: 'simple',
        status: 'publish',
        regular_price: '25.00',
        sku: uniqueSku('TEST-FLOW-STATUS'),
      });

      const order = await createOrder({
        status: 'pending',
        currency: 'EUR',
        line_items: [
          {
            product_id: product.id,
            quantity: 1,
            total: '25.00',
          },
        ],
        billing: {
          first_name: 'Status',
          last_name: 'Change',
          email: 'status@test-flow.test',
        },
      });

      expect(order.status).toBe('pending');
      expect(order.dateCompleted).toBeNull();

      // Update to completed
      const updated = await updateOrder(order.id, {
        status: 'completed',
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe('completed');
      expect(updated?.dateCompleted).not.toBeNull();
    });

    it('should set paid date when set_paid is true', async () => {
      const product = await productService.create({
        name: 'Payment Test Product',
        type: 'simple',
        status: 'publish',
        regular_price: '15.00',
        sku: uniqueSku('TEST-FLOW-PAID'),
      });

      const order = await createOrder({
        status: 'pending',
        currency: 'EUR',
        line_items: [
          {
            product_id: product.id,
            quantity: 1,
            total: '15.00',
          },
        ],
        billing: {
          first_name: 'Payment',
          last_name: 'Test',
          email: 'payment@test-flow.test',
        },
      });

      expect(order.datePaid).toBeNull();

      // Mark as paid
      const updated = await updateOrder(order.id, {
        set_paid: true,
      });

      expect(updated?.datePaid).not.toBeNull();
      // Status should auto-change to processing
      expect(updated?.status).toBe('processing');
    });
  });

  describe('Order Refunds', () => {
    
    it('should create refund and change order status to refunded for full refund', async () => {
      const product = await productService.create({
        name: 'Refund Test Product',
        type: 'simple',
        status: 'publish',
        regular_price: '30.00',
        sku: uniqueSku('TEST-FLOW-REFUND'),
      });

      const order = await createOrder({
        status: 'completed',
        currency: 'EUR',
        line_items: [
          {
            product_id: product.id,
            quantity: 1,
            total: '30.00',
          },
        ],
        billing: {
          first_name: 'Refund',
          last_name: 'Test',
          email: 'refund@test-flow.test',
        },
      });

      // Create full refund
      const refund = await createRefund(order.id, {
        amount: '30.00',
        reason: 'Customer requested full refund',
      });

      expect(refund).toBeDefined();
      expect(refund.amount).toBe('30.00');
      expect(refund.reason).toBe('Customer requested full refund');

      // Verify order status changed to refunded
      const updatedOrder = await getOrder(order.id);
      expect(updatedOrder?.status).toBe('refunded');
    });

    it('should not change status for partial refund', async () => {
      const product = await productService.create({
        name: 'Partial Refund Product',
        type: 'simple',
        status: 'publish',
        regular_price: '100.00',
        sku: uniqueSku('TEST-FLOW-PARTIAL'),
      });

      const order = await createOrder({
        status: 'completed',
        currency: 'EUR',
        line_items: [
          {
            product_id: product.id,
            quantity: 1,
            total: '100.00',
          },
        ],
        billing: {
          first_name: 'Partial',
          last_name: 'Refund',
          email: 'partial@test-flow.test',
        },
      });

      // Create partial refund (€20 of €100)
      const refund = await createRefund(order.id, {
        amount: '20.00',
        reason: 'Partial refund',
      });

      expect(refund.amount).toBe('20.00');

      // Order status should still be completed (not fully refunded)
      const updatedOrder = await getOrder(order.id);
      expect(updatedOrder?.status).toBe('completed');
    });
  });

  describe('Order Deletion', () => {
    
    it('should soft delete order by default', async () => {
      const product = await productService.create({
        name: 'Delete Test Product',
        type: 'simple',
        status: 'publish',
        regular_price: '10.00',
        sku: uniqueSku('TEST-FLOW-DELETE'),
      });

      const order = await createOrder({
        status: 'pending',
        currency: 'EUR',
        line_items: [
          {
            product_id: product.id,
            quantity: 1,
            total: '10.00',
          },
        ],
        billing: {
          first_name: 'Delete',
          last_name: 'Test',
          email: 'delete@test-flow.test',
        },
      });

      // Soft delete (default)
      const { deleteOrder } = await import('../services/order.service');
      const deleted = await deleteOrder(order.id, false);

      expect(deleted).toBeDefined();
      expect(deleted?.status).toBe('trash');

      // Should not be found
      const notFound = await getOrder(order.id);
      expect(notFound).toBeNull();
    });
  });
});
