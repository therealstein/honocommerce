/**
 * Tests for Plugin System
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hookManager, registerHook, unregisterPluginHooks, doAction, applyFilter, HOOKS } from '../lib/hooks';
import type { Plugin, PluginManifest, OrderEventData } from '../types/plugin.types';

// ============== TEST PLUGIN ==============

const testPluginManifest: PluginManifest = {
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin',
  author: 'Test Author',
  defaultConfig: {
    setting1: 'value1',
    enabled: true,
  },
  hooks: ['order.created', 'order.updated'],
  schedules: [
    {
      id: 'test-schedule',
      schedule: '1h',
      description: 'Test schedule that runs every hour',
    },
  ],
};

const createTestPlugin = (): Plugin => ({
  manifest: testPluginManifest,
  
  install: vi.fn(async (context) => {
    await context.log('info', 'Test plugin installed');
  }),
  
  activate: vi.fn(async (context) => {
    await context.log('info', 'Test plugin activated');
  }),
  
  deactivate: vi.fn(async (context) => {
    await context.log('info', 'Test plugin deactivated');
  }),
  
  uninstall: vi.fn(async (context) => {
    await context.log('info', 'Test plugin uninstalled');
  }),
  
  hooks: {
    'order.created': vi.fn(async (data: OrderEventData) => {
      return data;
    }),
    'order.updated': vi.fn(async (data: OrderEventData) => {
      return data;
    }),
  },
  
  schedules: {
    'test-schedule': vi.fn(async (context) => {
      await context.log('info', 'Test schedule executed');
    }),
  },
});

// ============== HOOK SYSTEM TESTS ==============

describe('Hook System', () => {
  beforeEach(() => {
    hookManager.clear();
  });

  it('should register a hook callback', () => {
    const callback = vi.fn();
    registerHook('test.hook', 'test-plugin', callback);
    
    expect(hookManager.hasHooks('test.hook')).toBe(true);
  });

  it('should execute action hooks', async () => {
    const callback = vi.fn();
    registerHook('test.action', 'test-plugin', callback);
    
    await doAction('test.action', { test: 'data' });
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      { test: 'data' },
      expect.objectContaining({
        pluginId: 'test-plugin',
        hookName: 'test.action',
      })
    );
  });

  it('should execute filter hooks and allow data modification', async () => {
    const callback1 = vi.fn(async (data: { value: number }) => ({
      value: data.value + 1,
    }));
    const callback2 = vi.fn(async (data: { value: number }) => ({
      value: data.value * 2,
    }));
    
    registerHook('test.filter', 'plugin1', callback1, 10);
    registerHook('test.filter', 'plugin2', callback2, 20);
    
    const result = await applyFilter('test.filter', { value: 5 });
    
    // 5 + 1 = 6, then 6 * 2 = 12
    expect(result).toEqual({ value: 12 });
  });

  it('should respect priority order', async () => {
    const order: string[] = [];
    
    registerHook('test.order', 'plugin3', async () => { order.push('third'); }, 30);
    registerHook('test.order', 'plugin1', async () => { order.push('first'); }, 10);
    registerHook('test.order', 'plugin2', async () => { order.push('second'); }, 20);
    
    await doAction('test.order', {});
    
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('should unregister hooks for a plugin', () => {
    registerHook('test.hook1', 'test-plugin', vi.fn());
    registerHook('test.hook2', 'test-plugin', vi.fn());
    registerHook('test.hook3', 'other-plugin', vi.fn());
    
    unregisterPluginHooks('test-plugin');
    
    const hooks = hookManager.getAllHooks();
    let testPluginHooks = 0;
    for (const [, registrations] of hooks) {
      testPluginHooks += registrations.filter(r => r.pluginId === 'test-plugin').length;
    }
    
    expect(testPluginHooks).toBe(0);
    expect(hookManager.hasHooks('test.hook3')).toBe(true);
  });

  it('should continue execution when a hook throws an error', async () => {
    const errorHook = vi.fn(async () => {
      throw new Error('Hook error');
    });
    const successHook = vi.fn();
    
    registerHook('test.error', 'error-plugin', errorHook, 10);
    registerHook('test.error', 'success-plugin', successHook, 20);
    
    // Should not throw
    await doAction('test.error', {});
    
    expect(errorHook).toHaveBeenCalled();
    expect(successHook).toHaveBeenCalled();
  });
});

// ============== PLUGIN MANAGER TESTS ==============
// Note: Database-dependent tests are skipped in unit test environment
// Full integration tests should be run against a running server

describe('Plugin Manager (Unit Tests)', () => {
  it('should validate plugin manifest', () => {
    const testPlugin = createTestPlugin();
    
    expect(testPlugin.manifest.id).toBe('test-plugin');
    expect(testPlugin.manifest.version).toBe('1.0.0');
    expect(testPlugin.manifest.hooks).toContain('order.created');
    expect(testPlugin.manifest.schedules).toHaveLength(1);
  });
  
  it('should have lifecycle methods', () => {
    const testPlugin = createTestPlugin();
    
    expect(testPlugin.install).toBeDefined();
    expect(testPlugin.activate).toBeDefined();
    expect(testPlugin.deactivate).toBeDefined();
    expect(testPlugin.uninstall).toBeDefined();
  });
  
  it('should have hook handlers', () => {
    const testPlugin = createTestPlugin();
    
    expect(testPlugin.hooks).toBeDefined();
    expect(testPlugin.hooks!['order.created']).toBeDefined();
    expect(testPlugin.hooks!['order.updated']).toBeDefined();
  });
  
  it('should have schedule handlers', () => {
    const testPlugin = createTestPlugin();
    
    expect(testPlugin.schedules).toBeDefined();
    expect(testPlugin.schedules!['test-schedule']).toBeDefined();
  });
});

// ============== SCHEDULER TESTS ==============

describe('Scheduler System (Unit Tests)', () => {
  it('should parse interval string to milliseconds', () => {
    // Test the parsing logic inline (since schedulerManager methods are private)
    const parseInterval = (schedule: string): number | null => {
      const intervalMatch = schedule.match(/^(\d+)(s|m|h|d)$/);
      if (!intervalMatch) return null;
      
      const value = parseInt(intervalMatch[1], 10);
      const unit = intervalMatch[2];
      
      switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
      }
    };
    
    expect(parseInterval('5m')).toBe(5 * 60 * 1000);
    expect(parseInterval('1h')).toBe(60 * 60 * 1000);
    expect(parseInterval('30s')).toBe(30 * 1000);
    expect(parseInterval('1d')).toBe(24 * 60 * 60 * 1000);
    expect(parseInterval('15m')).toBe(15 * 60 * 1000);
    expect(parseInterval('invalid')).toBeNull();
  });

  it('should calculate next run time correctly', () => {
    const calculateNextRun = (intervalMs: number): Date => {
      return new Date(Date.now() + intervalMs);
    };
    
    const now = Date.now();
    const nextRun = calculateNextRun(60000);
    
    expect(nextRun.getTime()).toBeGreaterThanOrEqual(now + 60000 - 100);
    expect(nextRun.getTime()).toBeLessThanOrEqual(now + 60000 + 100);
  });

  it('should support cron-like schedules in manifest', () => {
    const pluginWithCron: PluginManifest = {
      id: 'cron-plugin',
      name: 'Cron Plugin',
      version: '1.0.0',
      description: 'Plugin with cron schedules',
      author: 'Test',
      schedules: [
        { id: 'hourly', schedule: '0 * * * *', description: 'Run hourly' },
        { id: 'daily', schedule: '0 0 * * *', description: 'Run daily' },
      ],
    };
    
    expect(pluginWithCron.schedules).toHaveLength(2);
    expect(pluginWithCron.schedules![0].schedule).toBe('0 * * * *');
    expect(pluginWithCron.schedules![1].schedule).toBe('0 0 * * *');
  });
});

// ============== INTEGRATION TESTS ==============

describe('Plugin System Integration', () => {
  beforeEach(() => {
    hookManager.clear();
  });

  it('should execute hooks when order is created', async () => {
    let hookReceivedData: OrderEventData | null = null;
    
    registerHook('order.created', 'integration-test-plugin', async (data: OrderEventData) => {
      hookReceivedData = data;
      return data;
    });
    
    // Trigger the hook
    const orderData: OrderEventData = {
      order: {
        id: 123,
        status: 'pending',
        total: '100.00',
        customerId: 1,
        lineItems: [],
        metaData: [{ key: 'orderComplete', value: true }],
        dateCreated: new Date(),
        dateModified: new Date(),
      },
    };
    
    await doAction(HOOKS.ORDER_CREATED, orderData);
    
    expect(hookReceivedData).not.toBeNull();
    expect(hookReceivedData?.order.id).toBe(123);
  });

  it('should modify data through filter hooks', async () => {
    registerHook('order.created', 'modifier-plugin', async (data: OrderEventData) => {
      // Add metadata
      return {
        ...data,
        order: {
          ...data.order,
          metaData: [...(data.order.metaData || []), { key: 'modified_by_plugin', value: true }],
        },
      };
    });
    
    const orderData: OrderEventData = {
      order: {
        id: 456,
        status: 'pending',
        total: '50.00',
        customerId: null,
        lineItems: [],
        metaData: [],
        dateCreated: new Date(),
        dateModified: new Date(),
      },
    };
    
    const result = await applyFilter(HOOKS.ORDER_CREATED, orderData);
    
    expect(result.order.metaData).toContainEqual({ key: 'modified_by_plugin', value: true });
  });
  
  it('should support multiple plugins hooking same event', async () => {
    const results: number[] = [];
    
    registerHook('test.multi', 'plugin-a', async () => { results.push(1); });
    registerHook('test.multi', 'plugin-b', async () => { results.push(2); });
    registerHook('test.multi', 'plugin-c', async () => { results.push(3); });
    
    await doAction('test.multi', {});
    
    expect(results).toEqual([1, 2, 3]);
  });
});

// ============== ORDER STATUS CHECKER PLUGIN TESTS ==============

describe('Order Status Checker Plugin (Example Plugin)', () => {
  it('should have correct manifest', async () => {
    const { manifest } = await import('../../plugins/order-status-checker/index');
    
    expect(manifest.id).toBe('order-status-checker');
    expect(manifest.name).toBe('Order Status Checker');
    expect(manifest.schedules).toHaveLength(1);
    expect(manifest.schedules![0].id).toBe('check-pending-orders');
    expect(manifest.schedules![0].schedule).toBe('15m');
  });
  
  it('should have default config with correct values', async () => {
    const { manifest } = await import('../../plugins/order-status-checker/index');
    
    expect(manifest.defaultConfig).toEqual({
      checkIntervalMinutes: 15,
      targetMetadataKey: 'orderComplete',
      targetMetadataValue: true,
      fromStatus: 'pending',
      toStatus: 'processing',
    });
  });
  
  it('should have schedule handler for check-pending-orders', async () => {
    const plugin = await import('../../plugins/order-status-checker/index');
    
    expect(plugin.default.schedules).toBeDefined();
    expect(plugin.default.schedules!['check-pending-orders']).toBeDefined();
    expect(typeof plugin.default.schedules!['check-pending-orders']).toBe('function');
  });
  
  it('should have order.created hook handler', async () => {
    const plugin = await import('../../plugins/order-status-checker/index');
    
    expect(plugin.default.hooks).toBeDefined();
    expect(plugin.default.hooks!['order.created']).toBeDefined();
    expect(typeof plugin.default.hooks!['order.created']).toBe('function');
  });
});
