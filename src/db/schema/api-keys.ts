/**
 * API Keys Schema
 * Stores WooCommerce-compatible consumer key/secret pairs
 * 
 * SECURITY: Keys are stored as hashes, not plaintext!
 * - key_prefix: First 15 chars for identification (e.g., "ck_test_abc123...")
 * - key_hash: SHA-256 hash of the full consumer key (for lookup)
 * - secret_hash: Argon2id hash of the consumer secret (password-grade)
 */

import { pgTable, serial, varchar, timestamp, boolean, text, integer } from 'drizzle-orm/pg-core';
import { index } from 'drizzle-orm/pg-core';

export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  
  // Key prefix for identification (first 15 chars of consumer key)
  // Example: "ck_test_abc123..." - used for lookup and display
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
  
  // SHA-256 hash of the full consumer key (for secure lookup)
  keyHash: varchar('key_hash', { length: 128 }).notNull(),
  
  // Argon2id hash of the consumer secret (password-grade security)
  secretHash: varchar('secret_hash', { length: 256 }).notNull(),
  
  // Legacy fields (for migration compatibility - will be removed)
  consumerKey: varchar('consumer_key', { length: 64 }),
  consumerSecret: varchar('consumer_secret', { length: 64 }),
  
  // Key description/name
  description: text('description'),
  
  // Associated user (if any)
  userId: integer('user_id'),
  
  // Permissions: read, write, read_write
  permissions: varchar('permissions', { length: 10 }).notNull().default('read_write'),
  
  // Rate limit (requests per hour)
  rateLimit: integer('rate_limit').default(1000),
  
  // Last access time
  lastAccess: timestamp('last_access'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
}, (table) => ({
  keyPrefixIdx: index('api_keys_key_prefix_idx').on(table.keyPrefix),
  keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
