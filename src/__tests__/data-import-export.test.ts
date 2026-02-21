/**
 * Tests for Data Export/Import Service
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../db';
import { products } from '../db/schema/products';
import { customers } from '../db/schema/customers';
import { coupons } from '../db/schema/coupons';
import { eq } from 'drizzle-orm';
import { exportService } from '../services/export.service';
import { importService } from '../services/import.service';
import { csvToObjects, objectsToCsv } from '../lib/csv-utils';

describe('CSV Utilities', () => {
  describe('objectsToCsv', () => {
    it('should convert objects to CSV with headers', () => {
      const data = [
        { name: 'Product 1', price: '10.00', sku: 'P001' },
        { name: 'Product 2', price: '20.00', sku: 'P002' },
      ];

      const csv = objectsToCsv(data);

      expect(csv).toContain('name,price,sku');
      expect(csv).toContain('Product 1,10.00,P001');
      expect(csv).toContain('Product 2,20.00,P002');
    });

    it('should handle empty data', () => {
      const csv = objectsToCsv([]);
      expect(csv).toBe('');
    });

    it('should escape fields with commas', () => {
      const data = [{ name: 'Product, with comma', price: '10.00' }];
      const csv = objectsToCsv(data);
      expect(csv).toContain('"Product, with comma"');
    });

    it('should escape fields with quotes', () => {
      const data = [{ name: 'Product "special"', price: '10.00' }];
      const csv = objectsToCsv(data);
      expect(csv).toContain('"Product ""special"""');
    });
  });

  describe('csvToObjects', () => {
    it('should parse CSV to objects', () => {
      const csv = 'name,price,sku\nProduct 1,10.00,P001\nProduct 2,20.00,P002';
      
      const objects = csvToObjects<{ name: string; price: string; sku: string }>(csv);
      
      expect(objects).toHaveLength(2);
      expect(objects[0].name).toBe('Product 1');
      expect(objects[0].price).toBe('10.00');
      expect(objects[1].name).toBe('Product 2');
    });

    it('should handle quoted fields', () => {
      const csv = 'name,price\n"Product, with comma","10.00"';
      const objects = csvToObjects<{ name: string; price: string }>(csv);
      
      expect(objects[0].name).toBe('Product, with comma');
    });

    it('should handle escaped quotes', () => {
      const csv = 'name,price\n"Product ""special""","10.00"';
      const objects = csvToObjects<{ name: string; price: string }>(csv);
      
      expect(objects[0].name).toBe('Product "special"');
    });

    it('should skip empty lines', () => {
      const csv = 'name,price\nProduct 1,10.00\n\nProduct 2,20.00';
      const objects = csvToObjects<{ name: string; price: string }>(csv);
      
      expect(objects).toHaveLength(2);
    });
  });
});

describe('Product Export Service', () => {
  beforeEach(async () => {
    // Clean up products
    await db.delete(products);
  });

  it('should export products to CSV', async () => {
    // Create test products
    await db.insert(products).values([
      {
        name: 'Export Product 1',
        slug: 'export-product-1',
        type: 'simple',
        status: 'publish',
        price: '10.00',
        regularPrice: '10.00',
        sku: 'EXP001',
        stockStatus: 'instock',
        manageStock: false,
        reviewsAllowed: true,
        parentId: 0,
        shippingClassId: 0,
        totalSales: 0,
        dateCreated: new Date(),
        dateCreatedGmt: new Date(),
        dateModified: new Date(),
        dateModifiedGmt: new Date(),
        isDeleted: false,
      },
      {
        name: 'Export Product 2',
        slug: 'export-product-2',
        type: 'simple',
        status: 'draft',
        price: '20.00',
        regularPrice: '20.00',
        sku: 'EXP002',
        stockStatus: 'instock',
        manageStock: false,
        reviewsAllowed: true,
        parentId: 0,
        shippingClassId: 0,
        totalSales: 0,
        dateCreated: new Date(),
        dateCreatedGmt: new Date(),
        dateModified: new Date(),
        dateModifiedGmt: new Date(),
        isDeleted: false,
      },
    ]);

    const csv = await exportService.products();

    expect(csv).toContain('name');
    expect(csv).toContain('Export Product 1');
    expect(csv).toContain('Export Product 2');
    expect(csv).toContain('EXP001');
    expect(csv).toContain('EXP002');
  });

  it('should filter products by status', async () => {
    await db.insert(products).values([
      {
        name: 'Published Product',
        slug: 'published-product',
        type: 'simple',
        status: 'publish',
        price: '10.00',
        regularPrice: '10.00',
        stockStatus: 'instock',
        manageStock: false,
        reviewsAllowed: true,
        parentId: 0,
        shippingClassId: 0,
        totalSales: 0,
        dateCreated: new Date(),
        dateCreatedGmt: new Date(),
        dateModified: new Date(),
        dateModifiedGmt: new Date(),
        isDeleted: false,
      },
      {
        name: 'Draft Product',
        slug: 'draft-product',
        type: 'simple',
        status: 'draft',
        price: '20.00',
        regularPrice: '20.00',
        stockStatus: 'instock',
        manageStock: false,
        reviewsAllowed: true,
        parentId: 0,
        shippingClassId: 0,
        totalSales: 0,
        dateCreated: new Date(),
        dateCreatedGmt: new Date(),
        dateModified: new Date(),
        dateModifiedGmt: new Date(),
        isDeleted: false,
      },
    ]);

    const csv = await exportService.products({ status: 'publish' });

    expect(csv).toContain('Published Product');
    expect(csv).not.toContain('Draft Product');
  });
});

describe('Product Import Service', () => {
  beforeEach(async () => {
    await db.delete(products);
  });

  it('should import new products from CSV', async () => {
    const csv = `name,sku,price,regular_price,status
Import Product 1,IMP001,10.00,10.00,publish
Import Product 2,IMP002,20.00,20.00,draft`;

    const result = await importService.products(csv);

    expect(result.created).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(2);

    // Verify products were created
    const imported1 = await db.select().from(products).where(eq(products.sku, 'IMP001'));
    expect(imported1).toHaveLength(1);
    expect(imported1[0].name).toBe('Import Product 1');

    const imported2 = await db.select().from(products).where(eq(products.sku, 'IMP002'));
    expect(imported2).toHaveLength(1);
    expect(imported2[0].name).toBe('Import Product 2');
  });

  it('should update existing products when updateExisting is true', async () => {
    // Create existing product
    await db.insert(products).values({
      name: 'Original Name',
      slug: 'original-name',
      type: 'simple',
      status: 'draft',
      price: '5.00',
      regularPrice: '5.00',
      sku: 'UPDATE001',
      stockStatus: 'instock',
      manageStock: false,
      reviewsAllowed: true,
      parentId: 0,
      shippingClassId: 0,
      totalSales: 0,
      dateCreated: new Date(),
      dateCreatedGmt: new Date(),
      dateModified: new Date(),
      dateModifiedGmt: new Date(),
      isDeleted: false,
    });

    const csv = `name,sku,price,regular_price,status
Updated Name,UPDATE001,15.00,15.00,publish`;

    const result = await importService.products(csv, { updateExisting: true });

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);

    // Verify product was updated
    const updated = await db.select().from(products).where(eq(products.sku, 'UPDATE001'));
    expect(updated[0].name).toBe('Updated Name');
    expect(updated[0].status).toBe('publish');
  });

  it('should skip invalid rows and continue', async () => {
    const csv = `name,sku,price,regular_price,status
Valid Product,VAL001,10.00,10.00,publish
,INV001,20.00,20.00,draft
Another Valid,VAL002,30.00,30.00,publish`;

    const result = await importService.products(csv, { skipErrors: true });

    expect(result.created).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Name is required');
  });

  it('should return error for empty CSV', async () => {
    const result = await importService.products('');

    expect(result.total).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('CSV data is empty');
  });
});

describe('Customer Export Service', () => {
  beforeEach(async () => {
    await db.delete(customers);
  });

  it('should export customers to CSV', async () => {
    await db.insert(customers).values([
      {
        email: 'export1@test.com',
        firstName: 'Export',
        lastName: 'User1',
        role: 'customer',
        billing: {},
        shipping: {},
        isPayingCustomer: false,
        dateCreated: new Date(),
        dateCreatedGmt: new Date(),
        dateModified: new Date(),
        dateModifiedGmt: new Date(),
        isDeleted: false,
      },
      {
        email: 'export2@test.com',
        firstName: 'Export',
        lastName: 'User2',
        role: 'customer',
        billing: {},
        shipping: {},
        isPayingCustomer: false,
        dateCreated: new Date(),
        dateCreatedGmt: new Date(),
        dateModified: new Date(),
        dateModifiedGmt: new Date(),
        isDeleted: false,
      },
    ]);

    const csv = await exportService.customers();

    expect(csv).toContain('email');
    expect(csv).toContain('export1@test.com');
    expect(csv).toContain('export2@test.com');
  });
});

describe('Customer Import Service', () => {
  beforeEach(async () => {
    await db.delete(customers);
  });

  it('should import new customers from CSV', async () => {
    const csv = `email,first_name,last_name,role
import1@test.com,Import,Customer1,customer
import2@test.com,Import,Customer2,customer`;

    const result = await importService.customers(csv);

    expect(result.created).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(2);
  });

  it('should update existing customers when updateExisting is true', async () => {
    // Create existing customer
    await db.insert(customers).values({
      email: 'update@test.com',
      firstName: 'Original',
      lastName: 'Name',
      role: 'customer',
      billing: {},
      shipping: {},
      isPayingCustomer: false,
      dateCreated: new Date(),
      dateCreatedGmt: new Date(),
      dateModified: new Date(),
      dateModifiedGmt: new Date(),
      isDeleted: false,
    });

    const csv = `email,first_name,last_name,role
update@test.com,Updated,Name,customer`;

    const result = await importService.customers(csv, { updateExisting: true });

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);

    // Verify customer was updated
    const updated = await db.select().from(customers).where(eq(customers.email, 'update@test.com'));
    expect(updated[0].firstName).toBe('Updated');
  });

  it('should validate email format', async () => {
    const csv = `email,first_name,last_name
invalid-email,Test,User
valid@test.com,Valid,User`;

    const result = await importService.customers(csv, { skipErrors: true });

    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toContain('Valid email');
  });
});

describe('Coupon Export Service', () => {
  beforeEach(async () => {
    await db.delete(coupons);
  });

  it('should export coupons to CSV', async () => {
    await db.insert(coupons).values([
      {
        code: 'EXPORT10',
        amount: '10.00',
        discountType: 'percent',
        usageCount: 0,
        individualUse: false,
        freeShipping: false,
        dateCreated: new Date(),
        dateCreatedGmt: new Date(),
        dateModified: new Date(),
        dateModifiedGmt: new Date(),
        isDeleted: false,
      },
      {
        code: 'EXPORT20',
        amount: '20.00',
        discountType: 'fixed_cart',
        usageCount: 5,
        individualUse: true,
        freeShipping: false,
        dateCreated: new Date(),
        dateCreatedGmt: new Date(),
        dateModified: new Date(),
        dateModifiedGmt: new Date(),
        isDeleted: false,
      },
    ]);

    const csv = await exportService.coupons();

    expect(csv).toContain('code');
    expect(csv).toContain('EXPORT10');
    expect(csv).toContain('EXPORT20');
    expect(csv).toContain('percent');
    expect(csv).toContain('fixed_cart');
  });
});
