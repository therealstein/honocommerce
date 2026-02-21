/**
 * Webhooks Schema
 */

import { pgTable, serial, varchar, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const webhooks = pgTable('webhooks', {
  id: serial('id').primaryKey(),
  
  // Name
  name: varchar('name', { length: 255 }).notNull(),
  
  // Status: active, paused, disabled
  status: varchar('status', { length: 20 }).notNull().default('active'),
  
  // Topic: order.created, product.updated, etc.
  topic: varchar('topic', { length: 50 }).notNull(),
  
  // Resource and event (derived from topic)
  resource: varchar('resource', { length: 50 }).notNull(),
  event: varchar('event', { length: 50 }).notNull(),
  
  // Hooks (WooCommerce internal hooks)
  hooks: jsonb('hooks').notNull().default([]).$type<string[]>(),
  
  // Delivery URL
  deliveryUrl: varchar('delivery_url', { length: 500 }).notNull(),
  
  // Secret for signature
  secret: varchar('secret', { length: 100 }).notNull(),
  
  // Dates
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateCreatedGmt: timestamp('date_created_gmt').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
  dateModifiedGmt: timestamp('date_modified_gmt').notNull().defaultNow(),
  
  // API key that created this webhook
  apiKeyId: integer('api_key_id'),
  
  // Delivery stats
  pendingDelivery: boolean('pending_delivery').notNull().default(false),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
});

// Webhook delivery logs
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: serial('id').primaryKey(),
  webhookId: integer('webhook_id').notNull(),
  
  // Delivery ID (UUID)
  deliveryId: varchar('delivery_id', { length: 36 }).notNull(),
  
  // Status: pending, delivered, failed
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  
  // Request/Response
  requestBody: jsonb('request_body').notNull(),
  requestHeaders: jsonb('request_headers').notNull().default({}),
  responseBody: text('response_body'),
  responseHeaders: jsonb('response_headers').default({}),
  responseCode: integer('response_code'),
  
  // Duration in ms
  duration: integer('duration'),
  
  // Error message if failed
  errorMessage: text('error_message'),
  
  // Retry count
  retryCount: integer('retry_count').notNull().default(0),
  
  // Dates
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateCompleted: timestamp('date_completed'),
});

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;

import { integer } from 'drizzle-orm/pg-core';
