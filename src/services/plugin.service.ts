/**
 * Plugin Manager Service
 * Handles plugin lifecycle, discovery, loading, and management
 */

import { db } from '../db';
import { plugins, pluginSettings, pluginLogs } from '../db/schema/plugins';
import { eq } from 'drizzle-orm';
import type {
  Plugin,
  PluginManifest,
  PluginContext,
  PluginServices,
  PluginState,
  PluginStatus,
  PluginLogEntry,
} from '../types/plugin.types';
import { hookManager, unregisterPluginHooks } from '../lib/hooks';
import { schedulerManager, unregisterPluginSchedules } from '../lib/scheduler';
import logger from '../lib/logger';

// ============== PLUGIN REGISTRY ==============

// In-memory plugin registry
const pluginRegistry: Map<string, Plugin> = new Map();

// ============== PLUGIN MANAGER ==============

class PluginManager {
  private pluginsDir: string = './plugins';

  /**
   * Initialize the plugin system
   */
  async initialize(): Promise<void> {
    logger.info('Initializing plugin system');
    
    // Start the scheduler
    schedulerManager.start();
    
    // Load active plugins from database
    const activePlugins = await db
      .select()
      .from(plugins)
      .where(eq(plugins.status, 'active'));
    
    logger.info('Found active plugins', { count: activePlugins.length });
    
    // Restore schedules
    await schedulerManager.restoreSchedules();
    
    logger.info('Plugin system initialized');
  }

  /**
   * Shutdown the plugin system
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down plugin system');
    
    // Deactivate all plugins
    for (const [pluginId] of pluginRegistry) {
      await this.deactivatePlugin(pluginId);
    }
    
    // Stop scheduler
    schedulerManager.stop();
    
    // Clear registry
    pluginRegistry.clear();
    
    logger.info('Plugin system shut down');
  }

  /**
   * Register a plugin (called by the plugin itself or during discovery)
   */
  registerPlugin(plugin: Plugin): void {
    const pluginId = plugin.manifest.id;
    pluginRegistry.set(pluginId, plugin);
    logger.debug('Plugin registered', { pluginId });
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(pluginId: string): void {
    pluginRegistry.delete(pluginId);
    logger.debug('Plugin unregistered', { pluginId });
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
    
    // Create context
    const context = this.createPluginContext(pluginId);
    
    // Run install hook
    if (plugin.install) {
      try {
        await plugin.install(context);
      } catch (error) {
        this.unregisterPlugin(pluginId);
        throw new Error(`Failed to install plugin ${pluginId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Persist to database
    const now = new Date();
    await db.insert(plugins).values({
      id: pluginId,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description ?? '',
      author: manifest.author ?? '',
      status: 'installed',
      isSystem: false,
      manifest: manifest as unknown as Record<string, unknown>,
      config: manifest.defaultConfig ?? {},
      dateInstalled: now,
      dateModified: now,
    });
    
    logger.info('Plugin installed', { pluginId, version: manifest.version });
    
    return this.getPluginState(pluginId) as Promise<PluginState>;
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId: string): Promise<PluginState> {
    const plugin = pluginRegistry.get(pluginId);
    const state = await this.getPluginState(pluginId);
    
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }
    
    if (!state) {
      throw new Error(`Plugin ${pluginId} is not installed`);
    }
    
    if (state.status === 'active') {
      throw new Error(`Plugin ${pluginId} is already active`);
    }
    
    const context = this.createPluginContext(pluginId);
    
    try {
      // Run activate hook
      if (plugin.activate) {
        await plugin.activate(context);
      }
      
      // Register hooks
      if (plugin.hooks) {
        for (const [hookName, callback] of Object.entries(plugin.hooks)) {
          if (callback) {
            hookManager.register(hookName, pluginId, callback);
          }
        }
      }
      
      // Register schedules
      if (plugin.schedules && plugin.manifest.schedules) {
        for (const scheduleDef of plugin.manifest.schedules) {
          const handler = plugin.schedules[scheduleDef.id];
          if (handler) {
            await schedulerManager.register(
              pluginId,
              scheduleDef.id,
              scheduleDef.schedule,
              handler,
              context
            );
          }
        }
      }
      
      // Update status
      const now = new Date();
      await db
        .update(plugins)
        .set({
          status: 'active',
          dateActivated: now,
          dateModified: now,
          lastError: null,
        })
        .where(eq(plugins.id, pluginId));
      
      logger.info('Plugin activated', { pluginId });
      
    } catch (error) {
      // Update error
      await db
        .update(plugins)
        .set({
          status: 'error',
          lastError: error instanceof Error ? error.message : 'Unknown error',
          dateModified: new Date(),
        })
        .where(eq(plugins.id, pluginId));
      
      throw error;
    }
    
    return this.getPluginState(pluginId) as Promise<PluginState>;
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId: string): Promise<PluginState> {
    const plugin = pluginRegistry.get(pluginId);
    const state = await this.getPluginState(pluginId);
    
    if (!state) {
      throw new Error(`Plugin ${pluginId} is not installed`);
    }
    
    if (state.status !== 'active') {
      throw new Error(`Plugin ${pluginId} is not active`);
    }
    
    const context = this.createPluginContext(pluginId);
    
    try {
      // Run deactivate hook
      if (plugin?.deactivate) {
        await plugin.deactivate(context);
      }
      
      // Unregister hooks
      unregisterPluginHooks(pluginId);
      
      // Unregister schedules
      await unregisterPluginSchedules(pluginId);
      
      // Update status
      const now = new Date();
      await db
        .update(plugins)
        .set({
          status: 'inactive',
          dateModified: now,
        })
        .where(eq(plugins.id, pluginId));
      
      logger.info('Plugin deactivated', { pluginId });
      
    } catch (error) {
      await db
        .update(plugins)
        .set({
          status: 'error',
          lastError: error instanceof Error ? error.message : 'Unknown error',
          dateModified: new Date(),
        })
        .where(eq(plugins.id, pluginId));
      
      throw error;
    }
    
    return this.getPluginState(pluginId) as Promise<PluginState>;
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
    
    try {
      // Run uninstall hook
      if (plugin?.uninstall) {
        await plugin.uninstall(context);
      }
      
      // Unregister from memory
      this.unregisterPlugin(pluginId);
      
      // Remove from database
      await db.delete(plugins).where(eq(plugins.id, pluginId));
      await db.delete(pluginSettings).where(eq(pluginSettings.pluginId, pluginId));
      
      logger.info('Plugin uninstalled', { pluginId });
      
    } catch (error) {
      throw new Error(`Failed to uninstall plugin ${pluginId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get plugin state from database
   */
  async getPluginState(pluginId: string): Promise<PluginState | null> {
    const [plugin] = await db
      .select()
      .from(plugins)
      .where(eq(plugins.id, pluginId))
      .limit(1);
    
    if (!plugin) return null;
    
    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description ?? '',
      author: plugin.author ?? '',
      status: plugin.status as PluginStatus,
      isSystem: plugin.isSystem,
      config: plugin.config,
      dateInstalled: plugin.dateInstalled,
      dateActivated: plugin.dateActivated,
      lastError: plugin.lastError,
    };
  }

  /**
   * List all installed plugins
   */
  async listPlugins(): Promise<PluginState[]> {
    const pluginList = await db.select().from(plugins);
    
    return pluginList.map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description ?? '',
      author: p.author ?? '',
      status: p.status as PluginStatus,
      isSystem: p.isSystem,
      config: p.config,
      dateInstalled: p.dateInstalled,
      dateActivated: p.dateActivated,
      lastError: p.lastError,
    }));
  }

  /**
   * Update plugin configuration
   */
  async updatePluginConfig(pluginId: string, config: Record<string, unknown>): Promise<void> {
    await db
      .update(plugins)
      .set({
        config,
        dateModified: new Date(),
      })
      .where(eq(plugins.id, pluginId));
  }

  /**
   * Get plugin configuration
   */
  async getPluginConfig(pluginId: string): Promise<Record<string, unknown>> {
    const [plugin] = await db
      .select({ config: plugins.config })
      .from(plugins)
      .where(eq(plugins.id, pluginId))
      .limit(1);
    
    return plugin?.config ?? {};
  }

  /**
   * Get plugin logs
   */
  async getPluginLogs(pluginId: string, limit: number = 100): Promise<PluginLogEntry[]> {
    const logs = await db
      .select()
      .from(pluginLogs)
      .where(eq(pluginLogs.pluginId, pluginId))
      .limit(limit);
    
    return logs.map(l => ({
      id: l.id,
      pluginId: l.pluginId,
      level: l.level as 'info' | 'warn' | 'error' | 'debug',
      message: l.message,
      data: l.data ?? null,
      timestamp: l.timestamp,
    }));
  }

  /**
   * Create plugin context
   */
  private createPluginContext(pluginId: string): PluginContext {
    const self = this;
    
    return {
      pluginId,
      
      getConfig: async () => {
        return self.getPluginConfig(pluginId);
      },
      
      setConfig: async (config: Record<string, unknown>) => {
        await self.updatePluginConfig(pluginId, config);
      },
      
      getConfigValue: async <T>(key: string, defaultValue?: T): Promise<T> => {
        const config = await self.getPluginConfig(pluginId);
        return (config[key] as T) ?? (defaultValue as T);
      },
      
      setConfigValue: async (key: string, value: unknown) => {
        const config = await self.getPluginConfig(pluginId);
        config[key] = value;
        await self.updatePluginConfig(pluginId, config);
      },
      
      log: async (level, message, data) => {
        await db.insert(pluginLogs).values({
          pluginId,
          level,
          message,
          data: data ?? null,
        });
      },
      
      services: self.createPluginServices(),
    };
  }

  /**
   * Create plugin services proxy
   */
  private createPluginServices(): PluginServices {
    // Import services dynamically to avoid circular dependencies
    // These are the actual service implementations
    const self = this;
    
    return {
      getProduct: async (id: number) => {
        const { getProduct } = await import('./product.service');
        return getProduct(id);
      },
      
      listProducts: async (params) => {
        const { listProducts } = await import('./product.service');
        return listProducts(params as Parameters<typeof listProducts>[0]);
      },
      
      createProduct: async (data) => {
        const { createProduct } = await import('./product.service');
        return createProduct(data as Parameters<typeof createProduct>[0]);
      },
      
      updateProduct: async (id, data) => {
        const { updateProduct } = await import('./product.service');
        return updateProduct(id, data as Parameters<typeof updateProduct>[1]);
      },
      
      deleteProduct: async (id, force) => {
        const { deleteProduct } = await import('./product.service');
        return deleteProduct(id, force);
      },
      
      getOrder: async (id: number) => {
        const { getOrder } = await import('./order.service');
        return getOrder(id);
      },
      
      listOrders: async (params) => {
        const { listOrders } = await import('./order.service');
        return listOrders(params as Parameters<typeof listOrders>[0]);
      },
      
      createOrder: async (data) => {
        const { createOrder } = await import('./order.service');
        return createOrder(data as Parameters<typeof createOrder>[0]);
      },
      
      updateOrder: async (id, data) => {
        const { updateOrder } = await import('./order.service');
        return updateOrder(id, data as Parameters<typeof updateOrder>[1]);
      },
      
      deleteOrder: async (id, force) => {
        const { deleteOrder } = await import('./order.service');
        return deleteOrder(id, force);
      },
      
      getCustomer: async (id: number) => {
        const { getCustomer } = await import('./customer.service');
        return getCustomer(id);
      },
      
      getCustomerByEmail: async (email: string) => {
        const { getCustomerByEmail } = await import('./customer.service');
        return getCustomerByEmail(email);
      },
      
      listCustomers: async (params) => {
        const { listCustomers } = await import('./customer.service');
        return listCustomers(params as Parameters<typeof listCustomers>[0]);
      },
      
      createCustomer: async (data) => {
        const { createCustomer } = await import('./customer.service');
        return createCustomer(data as Parameters<typeof createCustomer>[0]);
      },
      
      updateCustomer: async (id, data) => {
        const { updateCustomer } = await import('./customer.service');
        return updateCustomer(id, data as Parameters<typeof updateCustomer>[1]);
      },
      
      deleteCustomer: async (id, force) => {
        const { deleteCustomer } = await import('./customer.service');
        return deleteCustomer(id, force);
      },
      
      dispatchWebhook: async (event, data) => {
        const { dispatchWebhook } = await import('../webhooks/dispatcher');
        return dispatchWebhook(event, data);
      },
      
      db: {
        query: async <T>(sql: string, params?: unknown[]) => {
          return db.execute(db.session.connection.executeSql(sql, params ?? [])) as Promise<T[]>;
        },
        execute: async (sql: string, params?: unknown[]) => {
          await db.execute(db.session.connection.executeSql(sql, params ?? []));
        },
      },
      
      queue: {
        addJob: async (queueName: string, data: Record<string, unknown>) => {
          const { addJob } = await import('../queue');
          return addJob(queueName, data);
        },
      },
    };
  }
}

// Singleton instance
export const pluginManager = new PluginManager();

// ============== CONVENIENCE EXPORTS ==============

export const initializePluginSystem = (): Promise<void> => pluginManager.initialize();
export const shutdownPluginSystem = (): Promise<void> => pluginManager.shutdown();
export const installPlugin = (plugin: Plugin): Promise<PluginState> => pluginManager.installPlugin(plugin);
export const activatePlugin = (pluginId: string): Promise<PluginState> => pluginManager.activatePlugin(pluginId);
export const deactivatePlugin = (pluginId: string): Promise<PluginState> => pluginManager.deactivatePlugin(pluginId);
export const uninstallPlugin = (pluginId: string): Promise<void> => pluginManager.uninstallPlugin(pluginId);
export const listPlugins = (): Promise<PluginState[]> => pluginManager.listPlugins();
export const getPluginState = (pluginId: string): Promise<PluginState | null> => pluginManager.getPluginState(pluginId);
export const getPluginConfig = (pluginId: string): Promise<Record<string, unknown>> => pluginManager.getPluginConfig(pluginId);
export const updatePluginConfig = (pluginId: string, config: Record<string, unknown>): Promise<void> => 
  pluginManager.updatePluginConfig(pluginId, config);
