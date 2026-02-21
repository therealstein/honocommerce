/**
 * Product Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { productService } from '../services/product.service';
import { db } from '../db';
import { products } from '../db/schema/products';
import { eq, sql } from 'drizzle-orm';

// Test data with unique timestamp to avoid conflicts
const testTimestamp = Date.now();
const testProductInput = {
  name: 'Test Product',
  type: 'simple' as const,
  status: 'publish' as const,
  regular_price: '19.99',
  description: 'A test product',
  short_description: 'Test',
  sku: `TEST-${testTimestamp}`,
};

describe('Product Service', () => {
  // Clean up before each test
  beforeEach(async () => {
    // Delete all test products (those with TEST- prefix)
    await db.delete(products).where(sql`${products.sku} LIKE 'TEST-%'`);
  });

  describe('createProduct', () => {
    it('should create a product with required fields', async () => {
      const product = await productService.create(testProductInput);

      expect(product).toBeDefined();
      expect(product.id).toBeGreaterThan(0);
      expect(product.name).toBe(testProductInput.name);
      expect(product.type).toBe('simple');
      expect(product.status).toBe('publish');
      expect(product.regularPrice).toBe('19.99');
      expect(product.sku).toBe(testProductInput.sku);
    });

    it('should generate a slug from the name', async () => {
      const uniqueName = `My Unique Product ${Date.now()}`;
      const product = await productService.create({
        name: uniqueName,
      });

      expect(product.slug).toContain('my-unique-product');
    });

    it('should use default values for optional fields', async () => {
      const product = await productService.create({
        name: 'Minimal Product',
        sku: `TEST-MINIMAL-${Date.now()}`,
      });

      expect(product.type).toBe('simple');
      expect(product.status).toBe('draft');
      expect(product.featured).toBe(false);
      expect(product.virtual).toBe(false);
      expect(product.downloadable).toBe(false);
      expect(product.manageStock).toBe(false);
    });
  });

  describe('getProduct', () => {
    it('should return a product by ID', async () => {
      const created = await productService.create(testProductInput);
      const product = await productService.get(created.id);

      expect(product).toBeDefined();
      expect(product?.id).toBe(created.id);
      expect(product?.name).toBe(testProductInput.name);
    });

    it('should return null for non-existent ID', async () => {
      const product = await productService.get(999999);
      expect(product).toBeNull();
    });
  });

  describe('updateProduct', () => {
    it('should update product fields', async () => {
      const created = await productService.create(testProductInput);
      
      const updated = await productService.update(created.id, {
        name: 'Updated Name',
        regular_price: '29.99',
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.regularPrice).toBe('29.99');
    });

    it('should return null for non-existent ID', async () => {
      const result = await productService.update(999999, { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should update slug when name changes', async () => {
      const created = await productService.create(testProductInput);
      
      const updated = await productService.update(created.id, {
        name: 'New Product Name',
      });

      expect(updated?.slug).toBe('new-product-name');
    });
  });

  describe('deleteProduct', () => {
    it('should soft delete a product by default', async () => {
      const created = await productService.create(testProductInput);
      
      const deleted = await productService.delete(created.id);
      
      expect(deleted).toBeDefined();
      expect(deleted?.isDeleted).toBe(true);
      expect(deleted?.status).toBe('trash');
      
      // Should not be found by getProduct
      const notFound = await productService.get(created.id);
      expect(notFound).toBeNull();
    });

    it('should permanently delete with force=true', async () => {
      const created = await productService.create(testProductInput);
      
      const deleted = await productService.delete(created.id, true);
      
      expect(deleted).toBeDefined();
      expect(deleted?.id).toBe(created.id);
    });
  });

  describe('listProducts', () => {
    it('should return paginated list of products', async () => {
      // Create some products
      await productService.create({ name: 'Product A', sku: `TEST-LIST-A-${Date.now()}` });
      await productService.create({ name: 'Product B', sku: `TEST-LIST-B-${Date.now()}` });

      const result = await productService.list({
        page: 1,
        per_page: 10,
        order: 'desc',
        orderby: 'date',
      });

      expect(result.items.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(10);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('should filter by search term', async () => {
      const uniqueName = `Unique Search ${Date.now()}`;
      await productService.create({ name: uniqueName, sku: `TEST-SEARCH-${Date.now()}` });

      const result = await productService.list({
        page: 1,
        per_page: 10,
        search: uniqueName,
      });

      expect(result.items.some(p => p.name === uniqueName)).toBe(true);
    });
  });

  describe('batchCreateProducts', () => {
    it('should create multiple products', async () => {
      const ts = Date.now();
      const inputs = [
        { name: 'Batch Product 1', sku: `TEST-BATCH-1-${ts}` },
        { name: 'Batch Product 2', sku: `TEST-BATCH-2-${ts}` },
      ];

      const results = await productService.batchCreate(inputs);

      expect(results.length).toBe(2);
      expect(results[0].name).toBe('Batch Product 1');
      expect(results[1].name).toBe('Batch Product 2');
    });
  });
});
