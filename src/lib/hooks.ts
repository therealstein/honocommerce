/**
 * Hook System
 * Central event system for plugin communication
 */

import type { HookCallback, HookRegistration, HookContext } from '../types/plugin.types';
import logger from './logger';

// ============== HOOK MANAGER ==============

class HookManager {
  private hooks: Map<string, HookRegistration[]> = new Map();
  private pluginPriorities: Map<string, number> = new Map();

  /**
   * Register a hook callback
   */
  register<T>(
    hookName: string,
    pluginId: string,
    callback: HookCallback<T>,
    priority: number = 10
  ): void {
    const registration: HookRegistration = {
      hookName,
      pluginId,
      callback: callback as HookCallback,
      priority,
    };

    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    const hooks = this.hooks.get(hookName)!;
    hooks.push(registration);

    // Sort by priority (lower = higher priority)
    hooks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Unregister all hooks for a plugin
   */
  unregisterPlugin(pluginId: string): void {
    for (const [hookName, registrations] of this.hooks.entries()) {
      const filtered = registrations.filter(r => r.pluginId !== pluginId);
      this.hooks.set(hookName, filtered);
    }
    this.pluginPriorities.delete(pluginId);
  }

  /**
   * Unregister a specific hook
   */
  unregister(hookName: string, pluginId: string): void {
    const hooks = this.hooks.get(hookName);
    if (hooks) {
      const filtered = hooks.filter(r => r.pluginId !== pluginId);
      this.hooks.set(hookName, filtered);
    }
  }

  /**
   * Execute a filter hook (data can be modified by callbacks)
   */
  async executeFilter<T>(hookName: string, data: T): Promise<T> {
    const hooks = this.hooks.get(hookName);
    if (!hooks || hooks.length === 0) {
      return data;
    }

    let currentData = data;

    for (const registration of hooks) {
      const context: HookContext = {
        pluginId: registration.pluginId,
        hookName,
        timestamp: new Date(),
      };

      try {
        const result = await registration.callback(currentData, context);
        // If callback returns a value, use it as the new data
        if (result !== undefined) {
          currentData = result as T;
        }
      } catch (error) {
        logger.error('Error executing filter hook', { 
          hookName, 
          pluginId: registration.pluginId, 
          error: error instanceof Error ? error.message : String(error) 
        });
        // Continue with other hooks even if one fails
      }
    }

    return currentData;
  }

  /**
   * Execute an action hook (callbacks don't modify data)
   */
  async executeAction<T>(hookName: string, data: T): Promise<void> {
    const hooks = this.hooks.get(hookName);
    if (!hooks || hooks.length === 0) {
      return;
    }

    for (const registration of hooks) {
      const context: HookContext = {
        pluginId: registration.pluginId,
        hookName,
        timestamp: new Date(),
      };

      try {
        await registration.callback(data, context);
      } catch (error) {
        logger.error('Error executing action hook', { 
          hookName, 
          pluginId: registration.pluginId, 
          error: error instanceof Error ? error.message : String(error) 
        });
        // Continue with other hooks even if one fails
      }
    }
  }

  /**
   * Check if a hook has any registered callbacks
   */
  hasHooks(hookName: string): boolean {
    const hooks = this.hooks.get(hookName);
    return hooks !== undefined && hooks.length > 0;
  }

  /**
   * Get all registered hooks for a plugin
   */
  getPluginHooks(pluginId: string): string[] {
    const hookNames: string[] = [];
    for (const [hookName, registrations] of this.hooks.entries()) {
      if (registrations.some(r => r.pluginId === pluginId)) {
        hookNames.push(hookName);
      }
    }
    return hookNames;
  }

  /**
   * Get all registered hooks
   */
  getAllHooks(): Map<string, HookRegistration[]> {
    return new Map(this.hooks);
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear();
    this.pluginPriorities.clear();
  }
}

// Singleton instance
export const hookManager = new HookManager();

// ============== CONVENIENCE FUNCTIONS ==============

/**
 * Register a hook callback
 */
export const registerHook = <T>(
  hookName: string,
  pluginId: string,
  callback: HookCallback<T>,
  priority?: number
): void => {
  hookManager.register(hookName, pluginId, callback, priority);
};

/**
 * Unregister all hooks for a plugin
 */
export const unregisterPluginHooks = (pluginId: string): void => {
  hookManager.unregisterPlugin(pluginId);
};

/**
 * Execute a filter hook (data can be modified)
 */
export const applyFilter = <T>(hookName: string, data: T): Promise<T> => {
  return hookManager.executeFilter(hookName, data);
};

/**
 * Execute an action hook (callbacks don't modify data)
 */
export const doAction = <T>(hookName: string, data: T): Promise<void> => {
  return hookManager.executeAction(hookName, data);
};

// ============== HOOK NAMES ==============

export const HOOKS = {
  // Order hooks
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_DELETED: 'order.deleted',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_REFUNDED: 'order.refunded',
  
  // Product hooks
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
  
  // Customer hooks
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',
  
  // Coupon hooks
  COUPON_CREATED: 'coupon.created',
  COUPON_UPDATED: 'coupon.updated',
  COUPON_DELETED: 'coupon.deleted',
  
  // Webhook hooks
  WEBHOOK_DISPATCH: 'webhook.dispatch',
  WEBHOOK_DELIVERED: 'webhook.delivered',
  WEBHOOK_FAILED: 'webhook.failed',
  
  // Plugin hooks
  PLUGIN_ACTIVATED: 'plugin.activated',
  PLUGIN_DEACTIVATED: 'plugin.deactivated',
  PLUGIN_INSTALLED: 'plugin.installed',
  PLUGIN_UNINSTALLED: 'plugin.uninstalled',
} as const;

export type HookName = typeof HOOKS[keyof typeof HOOKS];
