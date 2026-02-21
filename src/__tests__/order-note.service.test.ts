/**
 * Order Notes Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { orders, orderItems, orderNotes } from '../db/schema/orders';
import { products } from '../db/schema/products';
import { sql, eq } from 'drizzle-orm';
import { orderNoteService } from '../services/order-note.service';
import { orderService } from '../services/order.service';
import { productService } from '../services/product.service';

const ts = Date.now();
const uniqueSku = (prefix: string) => `${prefix}-${ts}-${Math.random().toString(36).slice(7)}`;

describe('Order Notes Service', () => {
  let testOrderId: number;
  let testProductId: number;

  beforeAll(async () => {
    // Clean up
    await db.delete(orderNotes).where(sql`1=1`);
    await db.delete(orderItems).where(sql`1=1`);
    await db.delete(orders).where(sql`${orders.id} >= 1000`);
    await db.delete(products).where(sql`${products.sku} LIKE 'TEST-NOTE-%'`);

    // Create test product
    const product = await productService.create({
      name: 'Note Test Product',
      type: 'simple',
      status: 'publish',
      regular_price: '10.00',
      sku: uniqueSku('TEST-NOTE'),
    });
    testProductId = product.id;

    // Create test order
    const order = await orderService.create({
      status: 'pending',
      currency: 'EUR',
      line_items: [
        {
          product_id: testProductId,
          quantity: 1,
          total: '10.00',
        },
      ],
      billing: {
        first_name: 'Note',
        last_name: 'Test',
        email: 'note@test-order.test',
      },
    });
    testOrderId = order.id;
  });

  afterAll(async () => {
    await db.delete(orderNotes).where(sql`1=1`);
    await db.delete(orderItems).where(sql`1=1`);
    await db.delete(orders).where(sql`${orders.id} >= 1000`);
    await db.delete(products).where(sql`${products.sku} LIKE 'TEST-NOTE-%'`);
  });

  describe('createOrderNote', () => {
    it('should create an internal note', async () => {
      const note = await orderNoteService.create(testOrderId, {
        note: 'Internal note for testing',
        is_customer_note: false,
      });

      expect(note).toBeDefined();
      expect(note.id).toBeGreaterThan(0);
      expect(note.note).toBe('Internal note for testing');
      expect(note.isCustomerNote).toBe(false);
      expect(note.addedByUser).toBe(true);
      expect(note.isSystem).toBe(false);
    });

    it('should create a customer-visible note', async () => {
      const note = await orderNoteService.create(testOrderId, {
        note: 'Your order is being processed',
        is_customer_note: true,
      });

      expect(note.isCustomerNote).toBe(true);
    });

    it('should create a system note', async () => {
      const note = await orderNoteService.createSystem(
        testOrderId,
        'Order status changed to processing'
      );

      expect(note.isSystem).toBe(true);
      expect(note.addedByUser).toBe(false);
      expect(note.author).toBe(0);
    });
  });

  describe('listOrderNotes', () => {
    beforeAll(async () => {
      // Create some notes for filtering tests
      await orderNoteService.create(testOrderId, {
        note: 'Customer note 1',
        is_customer_note: true,
      });
      await orderNoteService.create(testOrderId, {
        note: 'Internal note 1',
        is_customer_note: false,
      });
    });

    it('should list all notes', async () => {
      const notes = await orderNoteService.list(testOrderId);
      expect(notes.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter customer notes only', async () => {
      const notes = await orderNoteService.list(testOrderId, 'customer');
      expect(notes.length).toBeGreaterThan(0);
      notes.forEach(note => {
        expect(note.isCustomerNote).toBe(true);
      });
    });

    it('should filter internal notes only', async () => {
      const notes = await orderNoteService.list(testOrderId, 'internal');
      expect(notes.length).toBeGreaterThan(0);
      notes.forEach(note => {
        expect(note.isCustomerNote).toBe(false);
      });
    });

    it('should return notes in reverse chronological order', async () => {
      const notes = await orderNoteService.list(testOrderId);
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i - 1].dateCreated.getTime()).toBeGreaterThanOrEqual(
          notes[i].dateCreated.getTime()
        );
      }
    });
  });

  describe('getOrderNote', () => {
    it('should get a single note', async () => {
      const created = await orderNoteService.create(testOrderId, {
        note: 'Note to retrieve',
      });

      const note = await orderNoteService.get(testOrderId, created.id);

      expect(note).toBeDefined();
      expect(note?.id).toBe(created.id);
      expect(note?.note).toBe('Note to retrieve');
    });

    it('should return null for non-existent note', async () => {
      const note = await orderNoteService.get(testOrderId, 9999999);
      expect(note).toBeNull();
    });

    it('should return null for wrong order ID', async () => {
      const created = await orderNoteService.create(testOrderId, {
        note: 'Note for order',
      });

      const note = await orderNoteService.get(9999999, created.id);
      expect(note).toBeNull();
    });
  });

  describe('deleteOrderNote', () => {
    it('should delete a note', async () => {
      const created = await orderNoteService.create(testOrderId, {
        note: 'Note to delete',
      });

      const deleted = await orderNoteService.delete(testOrderId, created.id);
      expect(deleted).toBeDefined();
      expect(deleted?.id).toBe(created.id);

      const note = await orderNoteService.get(testOrderId, created.id);
      expect(note).toBeNull();
    });

    it('should return null for non-existent note', async () => {
      const deleted = await orderNoteService.delete(testOrderId, 9999999);
      expect(deleted).toBeNull();
    });
  });
});
