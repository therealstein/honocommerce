# Plugin Database Schema Management

This document explains how plugins manage their own database schemas in Honocommerce, including migrations, table creation, and cleanup.

## Overview

Plugins in Honocommerce are fully self-contained, meaning they manage their own database tables independently from the core system. This allows plugins to be installed, updated, and removed without affecting the core database schema.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Plugin System                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │  Plugin Manifest │    │  Migrations Dir  │    │  Plugin Code  │ │
│  │  (index.ts)      │    │  /migrations/    │    │  (service.ts) │ │
│  │                  │    │                  │    │               │ │
│  │  migrations: []  │───▶│  001_initial.sql │    │  Raw SQL      │ │
│  │  uninstallSql:[] │    │  002_add_xxx.sql │    │  Queries      │ │
│  └──────────────────┘    └──────────────────┘    └───────────────┘ │
│           │                       │                       │         │
│           └───────────────────────┴───────────────────────┘         │
│                                   │                                  │
│                                   ▼                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Plugin Manager Service                     │  │
│  │                                                               │  │
│  │  installPlugin() {                                            │  │
│  │    1. Read SQL file from disk                                 │  │
│  │    2. db.execute(sql.raw(migrationSql))                       │  │
│  │    3. Run plugin.install() hook                               │  │
│  │  }                                                            │  │
│  │                                                               │  │
│  │  uninstallPlugin() {                                          │  │
│  │    1. Run plugin.uninstall() hook                             │  │
│  │    2. Execute uninstallSql statements (DROP TABLE...)         │  │
│  │  }                                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                   │                                  │
│                                   ▼                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    PostgreSQL Database                        │  │
│  │                                                               │  │
│  │  Core tables (managed by Drizzle):                           │  │
│  │    - products, orders, customers, coupons...                 │  │
│  │                                                               │  │
│  │  Plugin tables (managed by plugins):                         │  │
│  │    - subscriptions (created by subscriptions plugin)         │  │
│  │    - subscription_items                                       │  │
│  │    - subscription_notes, etc.                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Plugin Manifest

The plugin manifest defines the database schema lifecycle:

```typescript
// plugins/subscriptions/index.ts
const manifest: PluginManifest = {
  id: 'woocommerce-subscriptions',
  name: 'WooCommerce Subscriptions',
  version: '1.0.0',
  
  // SQL files to run during installation (relative to plugin directory)
  migrations: [
    'migrations/001_initial.sql',
    'migrations/002_add_retry_count.sql',  // Future migrations
  ],
  
  // SQL statements to run during uninstallation (cleanup)
  uninstallSql: [
    'DROP TABLE IF EXISTS subscription_notes;',
    'DROP TABLE IF EXISTS subscription_coupon_lines;',
    'DROP TABLE IF EXISTS subscription_fee_lines;',
    'DROP TABLE IF EXISTS subscription_tax_lines;',
    'DROP TABLE IF EXISTS subscription_shipping_lines;',
    'DROP TABLE IF EXISTS subscription_items;',
    'DROP TABLE IF EXISTS subscriptions;',
  ],
};
```

### Manifest Fields

| Field | Type | Description |
|-------|------|-------------|
| `migrations` | `string[]` | SQL file paths relative to plugin directory, executed in order during install |
| `uninstallSql` | `string[]` | SQL statements executed during uninstall (typically DROP TABLE) |

---

## Migration Files

Migration files are plain SQL files stored in the plugin's `migrations/` directory:

```
plugins/subscriptions/
├── index.ts
├── migrations/
│   ├── 001_initial.sql       # Initial schema
│   ├── 002_add_retry.sql     # Schema updates
│   └── 003_add_indexes.sql   # Performance improvements
└── service.ts
```

### Migration File Example

```sql
-- plugins/subscriptions/migrations/001_initial.sql
-- Subscriptions Plugin - Initial Schema Migration
-- Version: 1.0.0

-- Main subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  customer_id INTEGER NOT NULL DEFAULT 0,
  billing_period VARCHAR(10) NOT NULL DEFAULT 'month',
  billing_interval INTEGER NOT NULL DEFAULT 1,
  
  -- Dates
  date_created TIMESTAMP NOT NULL DEFAULT NOW(),
  start_date_gmt TIMESTAMP NOT NULL,
  next_payment_date_gmt TIMESTAMP,
  
  -- Totals
  total VARCHAR(20) NOT NULL DEFAULT '0.00',
  
  -- JSON fields
  billing JSONB NOT NULL DEFAULT '{}',
  shipping JSONB NOT NULL DEFAULT '{}',
  meta_data JSONB NOT NULL DEFAULT '[]',
  
  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_customer_id_idx ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_next_payment_idx ON subscriptions(next_payment_date_gmt);

-- Related tables
CREATE TABLE IF NOT EXISTS subscription_items (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total VARCHAR(20) NOT NULL DEFAULT '0.00'
);

CREATE INDEX IF NOT EXISTS subscription_items_subscription_id_idx 
  ON subscription_items(subscription_id);
```

### Best Practices for Migrations

1. **Use `IF NOT EXISTS`** - Makes migrations idempotent and safe to re-run
2. **Version prefix files** - Use `001_`, `002_`, etc. for ordering
3. **Include comments** - Document what each migration does
4. **Create indexes** - Add indexes for commonly queried columns
5. **One concern per migration** - Keep migrations focused

---

## Migration Execution

### Installation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Plugin Installation                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. installPlugin() called                                      │
│          │                                                      │
│          ▼                                                      │
│  2. Check if plugin already installed                           │
│          │                                                      │
│          ▼                                                      │
│  3. Register plugin in memory                                   │
│          │                                                      │
│          ▼                                                      │
│  4. For each migration in manifest.migrations:                  │
│     ├── Read SQL file from ./plugins/{pluginId}/{migration}     │
│     ├── Execute raw SQL against database                        │
│     └── Log success/failure                                     │
│          │                                                      │
│          ▼                                                      │
│  5. Run plugin.install() lifecycle hook                         │
│          │                                                      │
│          ▼                                                      │
│  6. Persist plugin state to database                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Plugin Manager Implementation

```typescript
// src/services/plugin.service.ts

class PluginManager {
  private pluginsDir: string = './plugins';

  /**
   * Execute a SQL migration file
   */
  private async executeMigration(
    pluginId: string,
    migrationPath: string
  ): Promise<void> {
    const fullPath = path.join(this.pluginsDir, pluginId, migrationPath);

    try {
      // Read the SQL file
      const migrationSql = await fs.readFile(fullPath, 'utf-8');

      // Execute against database
      await db.execute(sql.raw(migrationSql));

      logger.info('Migration executed', { pluginId, migration: migrationPath });
    } catch (error) {
      logger.error('Migration failed', {
        pluginId,
        migration: migrationPath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Migration failed: ${migrationPath}`);
    }
  }

  /**
   * Install a plugin
   */
  async installPlugin(plugin: Plugin): Promise<PluginState> {
    const manifest = plugin.manifest;
    const pluginId = manifest.id;

    // Check if already installed
    const existing = await this.getPluginState(pluginId);
    if (existing) {
      throw new Error(`Plugin ${pluginId} is already installed`);
    }

    // Register plugin in memory
    this.registerPlugin(plugin);

    // Run migrations
    if (manifest.migrations?.length) {
      for (const migration of manifest.migrations) {
        await this.executeMigration(pluginId, migration);
      }
    }

    // Run install hook
    const context = this.createPluginContext(pluginId);
    if (plugin.install) {
      await plugin.install(context);
    }

    // Persist to database
    await db.insert(plugins).values({
      id: pluginId,
      name: manifest.name,
      version: manifest.version,
      status: 'installed',
      // ...
    });

    return this.getPluginState(pluginId);
  }
}
```

---

## Uninstallation & Cleanup

When a plugin is uninstalled, all its database tables are removed:

```typescript
// src/services/plugin.service.ts

/**
 * Execute uninstall SQL statements
 */
private async executeUninstallSql(
  pluginId: string,
  sqlStatements: string[]
): Promise<void> {
  for (const statement of sqlStatements) {
    try {
      await db.execute(sql.raw(statement));
      logger.debug('Uninstall SQL executed', { 
        pluginId, 
        sql: statement.substring(0, 50) + '...' 
      });
    } catch (error) {
      // Log warning but continue with other statements
      logger.warn('Uninstall SQL failed (continuing)', {
        pluginId,
        sql: statement.substring(0, 50) + '...',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Uninstall a plugin
 */
async uninstallPlugin(pluginId: string): Promise<void> {
  const plugin = pluginRegistry.get(pluginId);
  const state = await this.getPluginState(pluginId);

  if (!state) {
    throw new Error(`Plugin ${pluginId} is not installed`);
  }

  // Deactivate first if active
  if (state.status === 'active') {
    await this.deactivatePlugin(pluginId);
  }

  const context = this.createPluginContext(pluginId);

  // Run uninstall hook
  if (plugin?.uninstall) {
    await plugin.uninstall(context);
  }

  // Run uninstall SQL (drop tables)
  if (plugin?.manifest.uninstallSql?.length) {
    await this.executeUninstallSql(pluginId, plugin.manifest.uninstallSql);
  }

  // Unregister from memory
  this.unregisterPlugin(pluginId);

  // Remove from database
  await db.delete(plugins).where(eq(plugins.id, pluginId));
  await db.delete(pluginSettings).where(eq(pluginSettings.pluginId, pluginId));
}
```

---

## Querying Plugin Tables

Since plugin tables are not registered in Drizzle's schema, plugins must use raw SQL queries:

```typescript
// plugins/subscriptions/service.ts

import { db } from '../../src/db';
import { sql } from 'drizzle-orm';

/**
 * List subscriptions with pagination
 */
export const listSubscriptions = async (params: SubscriptionListQuery) => {
  const { page, per_page, status, customer } = params;
  
  // Build WHERE clause
  const conditions: string[] = ['is_deleted = false'];
  
  if (status && status.length > 0) {
    const statusList = status.map(s => `'${s}'`).join(', ');
    conditions.push(`status IN (${statusList})`);
  }
  
  if (customer) {
    conditions.push(`customer_id = ${customer}`);
  }
  
  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM subscriptions 
    WHERE ${sql.raw(whereClause)}
  `);
  const total = Number(countResult[0]?.count ?? 0);

  // Get items
  const itemsResult = await db.execute(sql`
    SELECT * FROM subscriptions 
    WHERE ${sql.raw(whereClause)}
    ORDER BY date_created DESC
    LIMIT ${per_page} 
    OFFSET ${(page - 1) * per_page}
  `);

  return {
    items: itemsResult.rows,
    total,
    page,
    per_page,
    totalPages: Math.ceil(total / per_page),
  };
};

/**
 * Create a subscription
 */
export const createSubscription = async (input: CreateSubscriptionInput) => {
  const result = await db.execute(sql`
    INSERT INTO subscriptions (
      number, order_key, status, currency, customer_id,
      billing_period, billing_interval, start_date_gmt,
      billing, shipping, meta_data
    ) VALUES (
      ${generateSubscriptionNumber()},
      ${generateOrderKey()},
      ${input.status ?? 'pending'},
      ${input.currency ?? 'USD'},
      ${input.customer_id ?? 0},
      ${input.billing_period ?? 'month'},
      ${input.billing_interval ?? 1},
      ${input.start_date_gmt ? new Date(input.start_date_gmt) : new Date()},
      ${JSON.stringify(input.billing ?? {})}::jsonb,
      ${JSON.stringify(input.shipping ?? {})}::jsonb,
      ${JSON.stringify(input.meta_data ?? [])}::jsonb
    ) RETURNING *
  `);

  return result.rows[0];
};
```

### SQL Injection Prevention

When building dynamic queries, use parameterized queries:

```typescript
// ✅ SAFE - Parameterized query
await db.execute(sql`
  SELECT * FROM subscriptions 
  WHERE customer_id = ${customerId}
    AND status = ${status}
`);

// ✅ SAFE - Controlled values with escaping
const statusList = status.map(s => `'${s.replace(/'/g, "''")}'`).join(', ');
await db.execute(sql`
  SELECT * FROM subscriptions 
  WHERE status IN (${sql.raw(statusList)})
`);

// ❌ DANGEROUS - Never interpolate user input directly
const userInput = req.query.search; // Could be malicious
await db.execute(sql`
  SELECT * FROM subscriptions WHERE number LIKE '%${userInput}%'  // UNSAFE!
`);
```

---

## Plugin Directory Structure

A complete plugin with database schema management:

```
plugins/subscriptions/
├── index.ts                    # Plugin entry point
│   ├── manifest                # Plugin metadata
│   ├── migrations: []          # SQL files to run
│   ├── uninstallSql: []        # Cleanup SQL
│   ├── install()               # Lifecycle hook
│   ├── uninstall()             # Lifecycle hook
│   └── routes                  # REST endpoints
│
├── migrations/
│   ├── 001_initial.sql         # Initial schema (all tables)
│   ├── 002_add_retry_count.sql # Schema updates
│   └── 003_performance.sql     # Index optimizations
│
├── service.ts                  # Business logic (raw SQL)
├── routes.ts                   # Route handlers
├── validators.ts               # Zod schemas
├── formatter.ts                # Response formatting
└── types.ts                    # TypeScript types
```

---

## Complete Example: Subscriptions Plugin

### 1. Plugin Entry Point

```typescript
// plugins/subscriptions/index.ts

import type { Plugin, PluginManifest } from '../../src/types/plugin.types';
import { createSubscriptionRoutes } from './routes';

const manifest: PluginManifest = {
  id: 'woocommerce-subscriptions',
  name: 'WooCommerce Subscriptions',
  version: '1.0.0',
  description: 'Provides WooCommerce Subscriptions REST API compatibility',
  author: 'Honocommerce',
  
  // Database migrations
  migrations: [
    'migrations/001_initial.sql',
  ],
  
  // Cleanup on uninstall
  uninstallSql: [
    'DROP TABLE IF EXISTS subscription_notes;',
    'DROP TABLE IF EXISTS subscription_coupon_lines;',
    'DROP TABLE IF EXISTS subscription_fee_lines;',
    'DROP TABLE IF EXISTS subscription_tax_lines;',
    'DROP TABLE IF EXISTS subscription_shipping_lines;',
    'DROP TABLE IF EXISTS subscription_items;',
    'DROP TABLE IF EXISTS subscriptions;',
  ],
  
  defaultConfig: {
    enableRenewalReminders: true,
    renewalReminderDays: 3,
  },
};

const subscriptionsPlugin: Plugin = {
  manifest,
  
  install: async (context) => {
    await context.log('info', 'Installing WooCommerce Subscriptions plugin');
    // Migrations run automatically before this hook
  },
  
  uninstall: async (context) => {
    await context.log('info', 'Uninstalling - all data will be deleted');
    // Tables dropped automatically after this hook
  },
  
  routes: createSubscriptionRoutes(),
};

export default subscriptionsPlugin;
```

### 2. Migration File

```sql
-- plugins/subscriptions/migrations/001_initial.sql

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  customer_id INTEGER NOT NULL DEFAULT 0,
  billing_period VARCHAR(10) NOT NULL DEFAULT 'month',
  billing_interval INTEGER NOT NULL DEFAULT 1,
  start_date_gmt TIMESTAMP NOT NULL,
  next_payment_date_gmt TIMESTAMP,
  total VARCHAR(20) NOT NULL DEFAULT '0.00',
  billing JSONB NOT NULL DEFAULT '{}',
  shipping JSONB NOT NULL DEFAULT '{}',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_customer_id_idx ON subscriptions(customer_id);
```

### 3. Service with Raw SQL

```typescript
// plugins/subscriptions/service.ts

import { db } from '../../src/db';
import { sql } from 'drizzle-orm';

export const getSubscription = async (id: number) => {
  const result = await db.execute(sql`
    SELECT * FROM subscriptions 
    WHERE id = ${id} AND is_deleted = false 
    LIMIT 1
  `);
  
  return result.rows[0] ?? null;
};

export const createSubscription = async (input: CreateInput) => {
  const result = await db.execute(sql`
    INSERT INTO subscriptions (status, customer_id, start_date_gmt)
    VALUES (${input.status}, ${input.customer_id}, ${new Date()})
    RETURNING *
  `);
  
  return result.rows[0];
};
```

---

## Future Improvements

### Migration Tracking Table

Track which migrations have been executed:

```sql
CREATE TABLE plugin_migrations (
  id SERIAL PRIMARY KEY,
  plugin_id VARCHAR(100) NOT NULL,
  migration_name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  checksum VARCHAR(64),  -- SHA-256 of file content
  UNIQUE(plugin_id, migration_name)
);
```

Benefits:
- Know which migrations have run
- Detect if migration file changed after execution
- Support for incremental updates

### Rollback Support

Add down migrations for rollback:

```
migrations/
├── 001_initial.up.sql     # Apply migration
├── 001_initial.down.sql   # Rollback migration
```

```typescript
const manifest = {
  migrations: [
    { up: 'migrations/001_initial.up.sql', down: 'migrations/001_initial.down.sql' }
  ]
};
```

### TypeScript Schema Generation

Generate migration SQL from TypeScript types:

```typescript
// Define schema in TypeScript
const subscriptionSchema = defineTable('subscriptions', {
  id: serial(),
  status: varchar(20),
  // ...
});

// Auto-generate migration
generateMigration(subscriptionSchema);
```

---

## Summary

| Aspect | Implementation |
|--------|---------------|
| **Schema Definition** | SQL files in `migrations/` directory |
| **Installation** | Migrations run via `db.execute(sql.raw())` |
| **Queries** | Raw SQL using `db.execute(sql`...`)` |
| **Cleanup** | `uninstallSql` array with DROP statements |
| **Safety** | Use `IF NOT EXISTS` for idempotency |
| **Lifecycle** | Migrations run before `install()` hook |

This architecture ensures plugins are fully self-contained and can be installed, updated, and removed without affecting the core database schema or other plugins.
