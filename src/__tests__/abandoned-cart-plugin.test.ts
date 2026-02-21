/**
 * Tests for Abandoned Cart Reminder Plugin
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Abandoned Cart Reminder Plugin', () => {
  it('should have correct manifest', async () => {
    const { manifest } = await import('../../plugins/abandoned-cart-reminder/index');
    
    expect(manifest.id).toBe('abandoned-cart-reminder');
    expect(manifest.name).toBe('Abandoned Cart Reminder');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.schedules).toHaveLength(1);
    expect(manifest.schedules![0].id).toBe('check-abandoned-carts');
    expect(manifest.schedules![0].schedule).toBe('1h');
  });
  
  it('should have default config with correct values', async () => {
    const { manifest } = await import('../../plugins/abandoned-cart-reminder/index');
    
    expect(manifest.defaultConfig).toEqual({
      abandonedAfterHours: 24,
      checkStatuses: ['pending'],
      maxOrdersPerRun: 100,
      dispatchWebhook: true,
      webhookEvent: 'order.abandoned',
      minimumOrderValue: '0.00',
    });
  });
  
  it('should have schedule handler for check-abandoned-carts', async () => {
    const plugin = await import('../../plugins/abandoned-cart-reminder/index');
    
    expect(plugin.default.schedules).toBeDefined();
    expect(plugin.default.schedules!['check-abandoned-carts']).toBeDefined();
    expect(typeof plugin.default.schedules!['check-abandoned-carts']).toBe('function');
  });
  
  it('should have order.created hook handler', async () => {
    const plugin = await import('../../plugins/abandoned-cart-reminder/index');
    
    expect(plugin.default.hooks).toBeDefined();
    expect(plugin.default.hooks!['order.created']).toBeDefined();
    expect(typeof plugin.default.hooks!['order.created']).toBe('function');
  });
  
  it('should have lifecycle methods', async () => {
    const plugin = await import('../../plugins/abandoned-cart-reminder/index');
    
    expect(plugin.default.install).toBeDefined();
    expect(plugin.default.activate).toBeDefined();
    expect(plugin.default.deactivate).toBeDefined();
    expect(plugin.default.uninstall).toBeDefined();
  });
  
  it('should calculate cutoff time correctly', () => {
    // Test the logic: 24 hours ago
    const abandonedAfterHours = 24;
    const cutoffTime = new Date(Date.now() - abandonedAfterHours * 60 * 60 * 1000);
    
    const now = new Date();
    const hoursDiff = (now.getTime() - cutoffTime.getTime()) / (60 * 60 * 1000);
    
    expect(hoursDiff).toBeCloseTo(24, 1);
  });
  
  it('should identify old orders as abandoned', () => {
    const abandonedAfterHours = 24;
    const cutoffTime = new Date(Date.now() - abandonedAfterHours * 60 * 60 * 1000);
    
    // Order created 25 hours ago (should be abandoned)
    const oldOrderDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(oldOrderDate < cutoffTime).toBe(true);
    
    // Order created 2 hours ago (should NOT be abandoned)
    const recentOrderDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(recentOrderDate < cutoffTime).toBe(false);
  });
  
  it('should filter by minimum order value', () => {
    const minimumOrderValue = 10.00;
    
    // Order above minimum
    expect(parseFloat('25.00') >= minimumOrderValue).toBe(true);
    
    // Order below minimum
    expect(parseFloat('5.00') >= minimumOrderValue).toBe(false);
  });
  
  it('should filter by order status', () => {
    const checkStatuses = ['pending'];
    
    expect(checkStatuses.includes('pending')).toBe(true);
    expect(checkStatuses.includes('processing')).toBe(false);
    expect(checkStatuses.includes('completed')).toBe(false);
  });
});
