/**
 * Abandoned Cart Reminder Plugin
 * 
 * Monitors pending orders and identifies those that have been abandoned
 * (pending for too long without payment). Logs them for follow-up actions
 * like sending reminder emails.
 * 
 * Use case: Recover lost sales by identifying customers who started checkout
 * but didn't complete payment.
 */

import type {
  Plugin,
  PluginManifest,
  PluginContext,
  OrderEventData,
} from '../../src/types/plugin.types';

// ============== PLUGIN MANIFEST ==============

const manifest: PluginManifest = {
  id: 'abandoned-cart-reminder',
  name: 'Abandoned Cart Reminder',
  version: '1.0.0',
  description: 'Monitors pending orders and identifies abandoned carts for follow-up',
  author: 'Honocommerce',
  minVersion: '1.0.0',
  license: 'MIT',
  defaultConfig: {
    // How long before an order is considered abandoned (in hours)
    abandonedAfterHours: 24,
    // Order statuses to check for abandonment
    checkStatuses: ['pending'],
    // Maximum number of orders to process per run
    maxOrdersPerRun: 100,
    // Whether to dispatch a webhook event for each abandoned order
    dispatchWebhook: true,
    // Webhook event name to dispatch
    webhookEvent: 'order.abandoned',
    // Minimum order value to consider (skip small orders)
    minimumOrderValue: '0.00',
  },
  schedules: [
    {
      id: 'check-abandoned-carts',
      schedule: '1h', // Run every hour
      description: 'Check for abandoned orders pending too long',
    },
  ],
  hooks: ['order.created'],
};

// ============== PLUGIN IMPLEMENTATION ==============

const abandonedCartReminderPlugin: Plugin = {
  manifest,

  // Called when plugin is installed
  install: async (context: PluginContext) => {
    await context.log('info', 'Abandoned Cart Reminder plugin installed', {
      defaultConfig: manifest.defaultConfig,
    });
  },

  // Called when plugin is activated
  activate: async (context: PluginContext) => {
    const config = await context.getConfig();
    await context.log('info', 'Abandoned Cart Reminder plugin activated', {
      config,
      nextRun: 'Will check every hour for abandoned orders',
    });
  },

  // Called when plugin is deactivated
  deactivate: async (context: PluginContext) => {
    await context.log('info', 'Abandoned Cart Reminder plugin deactivated');
  },

  // Called when plugin is uninstalled
  uninstall: async (context: PluginContext) => {
    await context.log('info', 'Abandoned Cart Reminder plugin uninstalled');
  },

  // Hook handlers
  hooks: {
    // Log when new orders are created (for monitoring)
    'order.created': async (data: OrderEventData, context) => {
      const ctx = context as unknown as PluginContext;
      const config = await ctx.getConfig();
      const abandonedAfterHours = (config.abandonedAfterHours as number) ?? 24;
      
      await ctx.log('debug', 'New order created - will monitor for abandonment', {
        orderId: data.order.id,
        status: data.order.status,
        total: data.order.total,
        willCheckAfter: `${abandonedAfterHours} hours`,
      });
      
      return data;
    },
  },

  // Scheduled task handlers
  schedules: {
    'check-abandoned-carts': async (context: PluginContext) => {
      const config = await context.getConfig();
      
      const abandonedAfterHours = (config.abandonedAfterHours as number) ?? 24;
      const checkStatuses = (config.checkStatuses as string[]) ?? ['pending'];
      const maxOrdersPerRun = (config.maxOrdersPerRun as number) ?? 100;
      const dispatchWebhook = (config.dispatchWebhook as boolean) ?? true;
      const webhookEvent = (config.webhookEvent as string) ?? 'order.abandoned';
      const minimumOrderValue = parseFloat((config.minimumOrderValue as string) ?? '0.00');

      await context.log('info', 'Starting abandoned cart check', {
        abandonedAfterHours,
        checkStatuses,
        maxOrdersPerRun,
        minimumOrderValue,
      });

      try {
        // Calculate the cutoff time
        const cutoffTime = new Date(Date.now() - abandonedAfterHours * 60 * 60 * 1000);
        
        // Get orders in the statuses we're monitoring
        const result = await context.services.listOrders({
          status: checkStatuses.join(','),
          per_page: maxOrdersPerRun,
        }) as { items: Array<{
          id: number;
          status: string;
          total: string;
          customerId: number | null;
          dateCreated: Date;
          billing: Record<string, string>;
          lineItems: Array<{ name: string; productId: number; quantity: number }>;
        }> };

        const orders = result.items || [];
        const abandonedOrders: Array<{
          id: number;
          total: string;
          email: string;
          hoursPending: number;
        }> = [];

        for (const order of orders) {
          // Check if order is old enough to be considered abandoned
          const orderDate = new Date(order.dateCreated);
          if (orderDate > cutoffTime) {
            continue; // Order is too recent
          }

          // Check minimum order value
          const orderTotal = parseFloat(order.total || '0');
          if (orderTotal < minimumOrderValue) {
            continue; // Order is below minimum value
          }

          // Calculate hours pending
          const hoursPending = Math.round(
            (Date.now() - orderDate.getTime()) / (60 * 60 * 1000)
          );

          const billing = order.billing || {};
          const email = billing.email || '';

          abandonedOrders.push({
            id: order.id,
            total: order.total,
            email,
            hoursPending,
          });

          // Log each abandoned order
          await context.log('info', 'Found abandoned order', {
            orderId: order.id,
            status: order.status,
            total: order.total,
            email,
            hoursPending,
            itemCount: order.lineItems?.length || 0,
          });

          // Dispatch webhook if enabled
          if (dispatchWebhook) {
            try {
              await context.services.dispatchWebhook(webhookEvent, {
                order: {
                  id: order.id,
                  status: order.status,
                  total: order.total,
                  email,
                  hoursPending,
                  billing,
                  lineItems: order.lineItems,
                },
                timestamp: new Date().toISOString(),
              });
            } catch (webhookError) {
              await context.log('error', 'Failed to dispatch abandoned order webhook', {
                orderId: order.id,
                error: webhookError instanceof Error ? webhookError.message : 'Unknown error',
              });
            }
          }
        }

        // Summary log
        await context.log('info', 'Abandoned cart check complete', {
          totalChecked: orders.length,
          abandonedFound: abandonedOrders.length,
          totalValue: abandonedOrders.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0).toFixed(2),
        });

        // If many abandoned orders, add a warning
        if (abandonedOrders.length > 10) {
          await context.log('warn', 'High number of abandoned orders detected', {
            count: abandonedOrders.length,
            recommendation: 'Consider reviewing checkout process or sending bulk recovery emails',
          });
        }

      } catch (error) {
        await context.log('error', 'Error checking abandoned carts', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  },
};

export default abandonedCartReminderPlugin;

// Also export for direct import
export { manifest, abandonedCartReminderPlugin };
