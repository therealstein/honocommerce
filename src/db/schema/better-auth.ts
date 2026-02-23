/**
 * Better Auth Schema
 * Tables required by better-auth for user management, sessions, and API keys
 * 
 * These tables are separate from the WooCommerce-specific tables
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Users table for better-auth
 * Stores admin users who can manage API keys
 */
export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    
    // Admin plugin fields
    role: text('role').default('user'),
    banned: boolean('banned').default(false),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires'),
  },
  (table) => ({
    emailIdx: index('user_email_idx').on(table.email),
    roleIdx: index('user_role_idx').on(table.role),
  })
);

/**
 * Sessions table for better-auth
 */
export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    
    // Admin plugin field for impersonation
    impersonatedBy: text('impersonated_by'),
  },
  (table) => ({
    userIdIdx: index('session_user_id_idx').on(table.userId),
    tokenIdx: index('session_token_idx').on(table.token),
  })
);

/**
 * Accounts table for better-auth
 * Stores authentication methods (email/password, OAuth, etc.)
 */
export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('account_user_id_idx').on(table.userId),
    providerIdx: index('account_provider_idx').on(table.providerId),
  })
);

/**
 * Verification table for better-auth
 * Stores email verification tokens, password reset tokens, etc.
 */
export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    identifierIdx: index('verification_identifier_idx').on(table.identifier),
  })
);

/**
 * API Keys table for better-auth API Key plugin
 * Stores WooCommerce-compatible API keys
 */
export const apikey = pgTable(
  'apikey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    start: text('start'), // First few characters for identification
    prefix: text('prefix'), // Key prefix (e.g., "hc_")
    key: text('key').notNull().unique(), // Hashed key
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    
    // Refill system
    refillInterval: timestamp('refill_interval', { mode: 'date' }),
    refillAmount: timestamp('refill_amount', { mode: 'date' }),
    lastRefillAt: timestamp('last_refill_at'),
    
    // Status
    enabled: boolean('enabled').notNull().default(true),
    
    // Rate limiting
    rateLimitEnabled: boolean('rate_limit_enabled').notNull().default(true),
    rateLimitTimeWindow: timestamp('rate_limit_time_window', { mode: 'date' }),
    rateLimitMax: timestamp('rate_limit_max', { mode: 'date' }),
    requestCount: timestamp('request_count', { mode: 'date' }).default(null),
    remaining: timestamp('remaining', { mode: 'date' }),
    
    // Timestamps
    lastRequest: timestamp('last_request'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    
    // Permissions (stored as JSON)
    permissions: text('permissions'),
    
    // Metadata (stored as JSON)
    metadata: jsonb('metadata'),
  },
  (table) => ({
    userIdx: index('apikey_user_id_idx').on(table.userId),
    keyIdx: index('apikey_key_idx').on(table.key),
    startIdx: index('apikey_start_idx').on(table.start),
  })
);

// Type exports
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type ApiKey = typeof apikey.$inferSelect;
export type NewApiKey = typeof apikey.$inferInsert;
