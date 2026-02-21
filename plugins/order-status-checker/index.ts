/**
 * Order Status Checker Plugin
 * 
 * Checks pending orders after a delay and automatically updates them to processing
 * if they have specific metadata set.
 * 
 * Use case: External payment gateways that send webhook callbacks can set
 * orderComplete:true metadata, and this plugin will automatically process the order.
 */

import type {
  Plugin,
  PluginManifest,
  PluginContext,
  OrderEventData,
} from '../../src/types/plugin.types';

// ============== PLUGIN MANIFEST ==============

const manifest: PluginManifest = {
  id: 'order-status-checker',
  name: 'Order Status Checker',
  version: '1.0.0',
  description: 'Automatically updates pending orders to processing when orderComplete metadata is set',
  author: 'Honocommerce',
  minVersion: '1.0.0',
  license: 'MIT',
  defaultConfig: {
    checkIntervalMinutes: 15,
    targetMetadataKey: 'orderComplete',
    targetMetadataValue: true,
    fromStatus: 'pending',
    toStatus: 'processing',
  },
  schedules: [
    {
      id: 'check-pending-orders',
      schedule: '15m', // Run every 15 minutes
      description: 'Check pending orders for orderComplete metadata',
    },
  ],
  hooks: ['order.created'],
};

// ============== PLUGIN IMPLEMENTATION ==============

const orderStatusCheckerPlugin: Plugin = {
  manifest,

  // Called when plugin is installed
  install: async (context: PluginContext) => {
    await context.log('info', 'Order Status Checker plugin installed');
  },

  // Called when plugin is activated
  activate: async (context: PluginContext) => {
    await context.log('info', 'Order Status Checker plugin activated', {
      config: await context.getConfig(),
    });
  },

  // Called when plugin is deactivated
  deactivate: async (context: PluginContext) => {
    await context.log('info', 'Order Status Checker plugin deactivated');
  },

  // Called when plugin is uninstalled
  uninstall: async (context: PluginContext) => {
    await context.log('info', 'Order Status Checker plugin uninstalled');
  },

  // Hook handlers
  hooks: {
    // When an order is created, log it for debugging
    'order.created': async (data: OrderEventData, context) => {
      const config = await context.getConfig();
      const ctx = context as unknown as PluginContext;
      
      await ctx.log('debug', 'Order created, will check on next schedule run', {
        orderId: data.order.id,
        status: data.order.status,
        metadata: data.order.metaData,
      });
      
      return data;
    },
  },

  // Scheduled task handlers
  schedules: {
    'check-pending-orders': async (context: PluginContext) => {
      const config = await context.getConfig();
      const checkIntervalMinutes = config.checkIntervalMinutes as number ?? 15;
      const targetMetadataKey = config.targetMetadataKey as string ?? 'orderComplete';
      const targetMetadataValue = config.targetMetadataValue ?? true;
      const fromStatus = config.fromStatus as string ?? 'pending';
      const toStatus = config.toStatus as string ?? 'processing';

      await context.log('info', 'Starting pending order check', {
        checkIntervalMinutes,
        fromStatus,
        toStatus,
        targetMetadataKey,
      });

      try {
        // Get all pending orders
        const result = await context.services.listOrders({
          status: fromStatus,
          per_page: 100,
        }) as { items: Array<{
          id: number;
          status: string;
          metaData: Array<{ key: string; value: unknown }> | null;
          dateCreated: Date;
        }> };

        const orders = result.items || [];
        const cutoffTime = new Date(Date.now() - checkIntervalMinutes * 60 * 1000);

        await context.log('info', `Found ${orders.length} orders with status "${fromStatus}"`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const order of orders) {
          // Check if order is old enough (created before the cutoff time)
          const orderDate = new Date(order.dateCreated);
          if (orderDate > cutoffTime) {
            await context.log('debug', `Skipping order ${order.id} - created too recently`, {
              orderId: order.id,
              orderDate: orderDate.toISOString(),
              cutoffTime: cutoffTime.toISOString(),
            });
            skippedCount++;
            continue;
          }

          // Check for target metadata
          const metadata = order.metaData || [];
          const targetMeta = metadata.find(m => m.key === targetMetadataKey);

          if (targetMeta && targetMeta.value === targetMetadataValue) {
            // Update order status
            await context.services.updateOrder(order.id, {
              status: toStatus,
            });

            await context.log('info', `Updated order ${order.id} from "${fromStatus}" to "${toStatus}"`, {
              orderId: order.id,
              previousStatus: fromStatus,
              newStatus: toStatus,
              metadata: targetMeta,
            });

            updatedCount++;
          } else {
            await context.log('debug', `Order ${order.id} does not have required metadata`, {
              orderId: order.id,
              targetMetadataKey,
              targetMetadataValue,
              actualMetadata: targetMeta,
            });
          }
        }

        await context.log('info', 'Pending order check complete', {
          totalChecked: orders.length,
          updated: updatedCount,
          skipped: skippedCount,
        });

      } catch (error) {
        await context.log('error', 'Error checking pending orders', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  },
};

export default orderStatusCheckerPlugin;

// Also export for direct import
export { manifest, orderStatusCheckerPlugin };
