/**
 * WooCommerce Subscriptions Plugin
 * 
 * Provides full WooCommerce Subscriptions REST API compatibility
 * as a plugin for Honocommerce.
 */

import type { Plugin, PluginManifest, PluginContext } from '../../src/types/plugin.types';
import { createSubscriptionRoutes } from './routes';

// ============== PLUGIN MANIFEST ==============

const manifest: PluginManifest = {
  id: 'woocommerce-subscriptions',
  name: 'WooCommerce Subscriptions',
  version: '1.0.0',
  description: 'Provides WooCommerce Subscriptions REST API compatibility',
  author: 'Honocommerce',
  minVersion: '1.0.0',
  license: 'GPL-3.0',

  // Database migrations
  migrations: [
    'migrations/001_initial.sql',
  ],

  // Cleanup SQL on uninstall
  uninstallSql: [
    'DROP TABLE IF EXISTS subscription_notes;',
    'DROP TABLE IF EXISTS subscription_coupon_lines;',
    'DROP TABLE IF EXISTS subscription_fee_lines;',
    'DROP TABLE IF EXISTS subscription_tax_lines;',
    'DROP TABLE IF EXISTS subscription_shipping_lines;',
    'DROP TABLE IF EXISTS subscription_items;',
    'DROP TABLE IF EXISTS subscriptions;',
  ],

  // Configuration schema
  configSchema: {
    type: 'object',
    properties: {
      enableRenewalReminders: {
        type: 'boolean',
        default: true,
        description: 'Send renewal reminder emails',
      },
      renewalReminderDays: {
        type: 'number',
        default: 3,
        description: 'Days before renewal to send reminder',
      },
      maxRetryAttempts: {
        type: 'number',
        default: 3,
        description: 'Maximum payment retry attempts',
      },
    },
  },

  defaultConfig: {
    enableRenewalReminders: true,
    renewalReminderDays: 3,
    maxRetryAttempts: 3,
  },

  // Scheduled tasks
  schedules: [
    {
      id: 'process-renewals',
      schedule: '0 * * * *', // Hourly
      description: 'Process subscription renewals',
    },
    {
      id: 'send-renewal-reminders',
      schedule: '0 9 * * *', // Daily at 9am
      description: 'Send renewal reminder emails',
    },
    {
      id: 'process-payment-retries',
      schedule: '*/15 * * * *', // Every 15 minutes
      description: 'Process failed payment retries',
    },
  ],

  // Hooks this plugin responds to
  hooks: [
    'order.created',
    'order.status_changed',
  ],
};

// ============== PLUGIN IMPLEMENTATION ==============

const subscriptionsPlugin: Plugin = {
  manifest,

  // Install: Run migrations
  install: async (context: PluginContext) => {
    await context.log('info', 'Installing WooCommerce Subscriptions plugin');
    // Migrations are run automatically by plugin manager
  },

  // Activate: Register routes and hooks
  activate: async (context: PluginContext) => {
    await context.log('info', 'Activating WooCommerce Subscriptions plugin', {
      routesRegistered: true,
      schedulesEnabled: manifest.schedules?.length ?? 0,
    });
  },

  // Deactivate: Cleanup
  deactivate: async (context: PluginContext) => {
    await context.log('info', 'Deactivating WooCommerce Subscriptions plugin');
    // Routes are unregistered automatically by plugin manager
  },

  // Uninstall: Drop tables
  uninstall: async (context: PluginContext) => {
    await context.log('info', 'Uninstalling WooCommerce Subscriptions plugin', {
      warning: 'All subscription data will be permanently deleted',
    });
    // Tables dropped automatically via uninstallSql
  },

  // Hook handlers
  hooks: {
    'order.created': async (data, context) => {
      const ctx = context as unknown as PluginContext;

      // Check if order contains subscription products
      const hasSubscription = data.order.lineItems.some(item => {
        // Would need to check product meta for subscription type
        return false; // Placeholder
      });

      if (hasSubscription) {
        await ctx.log('info', 'Order contains subscription products', {
          orderId: data.order.id,
        });
      }

      return data;
    },

    'order.status_changed': async (data, context) => {
      const ctx = context as unknown as PluginContext;

      // Handle subscription-related status changes
      if (data.newStatus === 'completed') {
        // Check if this is a renewal order
        await ctx.log('debug', 'Order status changed to completed', {
          orderId: data.orderId,
          newStatus: data.newStatus,
        });
      }

      return data;
    },
  },

  // Scheduled task handlers
  schedules: {
    'process-renewals': async (context: PluginContext) => {
      await context.log('info', 'Processing subscription renewals');
      // TODO: Implement renewal logic
      // 1. Find subscriptions with next_payment_date_gmt <= now
      // 2. Create renewal orders
      // 3. Process payments
      // 4. Update subscription dates
    },

    'send-renewal-reminders': async (context: PluginContext) => {
      const config = await context.getConfig();
      const days = config.renewalReminderDays as number ?? 3;

      await context.log('info', 'Sending renewal reminders', { daysAhead: days });
      // TODO: Implement reminder logic
      // 1. Find subscriptions with next_payment_date_gmt within N days
      // 2. Queue reminder emails
    },

    'process-payment-retries': async (context: PluginContext) => {
      await context.log('info', 'Processing payment retries');
      // TODO: Implement retry logic
      // 1. Find subscriptions with payment_retry_date_gmt <= now
      // 2. Retry payment
      // 3. Update retry count and next retry date
    },
  },

  // Route registration
  routes: createSubscriptionRoutes(),
};

export default subscriptionsPlugin;

// Also export for direct import
export { manifest, subscriptionsPlugin, createSubscriptionRoutes };
