/**
 * API Keys Schema
 * Stores WooCommerce-compatible consumer key/secret pairs
 */

import { pgTable, serial, varchar, timestamp, boolean, text } from 'drizzle-orm/pg-core';

export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  
  // Consumer key (format: ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
  consumerKey: varchar('consumer_key', { length: 64 }).notNull().unique(),
  
  // Consumer secret (format: cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
  consumerSecret: varchar('consumer_secret', { length: 64 }).notNull(),
  
  // Key description/name
  description: text('description'),
  
  // Associated user (if any)
  userId: serial('user_id'),
  
  // Permissions: read, write, read_write
  permissions: varchar('permissions', { length: 10 }).notNull().default('read_write'),
  
  // Last access time
  lastAccess: timestamp('last_access'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
