#!/usr/bin/env bun
/**
 * Database Seed Script
 * Populates the database with test data
 * 
 * Usage: bun run scripts/seed.ts
 */

import { db } from '../src/db';
import { products } from '../src/db/schema/products';
import { apiKeys } from '../src/db/schema/api-keys';
import { customers } from '../src/db/schema/customers';
import { generateApiKeyPair, hashApiKeyPair } from '../src/lib/api-key-crypto';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Insert test products
    const insertedProducts = await db.insert(products).values([
      {
        name: 'Widget Pro',
        slug: 'widget-pro',
        type: 'simple',
        status: 'publish',
        featured: false,
        catalogVisibility: 'visible',
        description: 'A professional-grade widget',
        shortDescription: 'Pro widget',
        sku: 'WGT-001',
        price: '29.99',
        regularPrice: '29.99',
        taxStatus: 'taxable',
        manageStock: true,
        stockQuantity: 100,
        stockStatus: 'instock',
        reviewsAllowed: true,
      },
      {
        name: 'Gadget Plus',
        slug: 'gadget-plus',
        type: 'simple',
        status: 'publish',
        featured: true,
        catalogVisibility: 'visible',
        description: 'An enhanced gadget',
        shortDescription: 'Plus gadget',
        sku: 'GDG-002',
        price: '49.99',
        regularPrice: '49.99',
        taxStatus: 'taxable',
        manageStock: true,
        stockQuantity: 50,
        stockStatus: 'instock',
        reviewsAllowed: true,
      },
      {
        name: 'Super Tool',
        slug: 'super-tool',
        type: 'simple',
        status: 'publish',
        featured: false,
        catalogVisibility: 'visible',
        description: 'The ultimate tool',
        shortDescription: 'Super tool',
        sku: 'STL-003',
        price: '99.99',
        regularPrice: '99.99',
        taxStatus: 'taxable',
        manageStock: true,
        stockQuantity: 25,
        stockStatus: 'instock',
        reviewsAllowed: true,
      },
    ]).returning();

    console.log(`✅ Inserted ${insertedProducts.length} products`);

    // Generate and hash API key
    const { consumerKey, consumerSecret } = generateApiKeyPair('test');
    const hashedKeys = await hashApiKeyPair(consumerKey, consumerSecret);

    const [apiKey] = await db.insert(apiKeys).values({
      keyPrefix: hashedKeys.keyPrefix,
      keyHash: hashedKeys.keyHash,
      secretHash: hashedKeys.secretHash,
      description: 'Test API Key',
      permissions: 'read_write',
    }).returning();

    console.log(`✅ Inserted API key: ${hashedKeys.keyPrefix}...`);

    // Insert test customer
    const [customer] = await db.insert(customers).values({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      role: 'customer',
      billing: {
        first_name: 'Test',
        last_name: 'User',
        company: '',
        address_1: '123 Test St',
        address_2: '',
        city: 'Test City',
        state: 'CA',
        postcode: '12345',
        country: 'US',
        email: 'test@example.com',
        phone: '555-123-4567',
      },
      shipping: {
        first_name: 'Test',
        last_name: 'User',
        company: '',
        address_1: '123 Test St',
        address_2: '',
        city: 'Test City',
        state: 'CA',
        postcode: '12345',
        country: 'US',
      },
    }).returning();

    console.log(`✅ Inserted customer: ${customer.email}`);

    console.log('\n✅ Seed complete!');
    console.log('\nTest credentials:');
    console.log(`  Consumer Key: ${consumerKey}`);
    console.log(`  Consumer Secret: ${consumerSecret}`);
    console.log('\n⚠️  Store these credentials securely - they are only shown once!');
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
