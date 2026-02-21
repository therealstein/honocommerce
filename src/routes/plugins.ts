/**
 * Plugin API Routes
 * REST endpoints for plugin management
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  listPlugins,
  getPluginState,
  activatePlugin,
  deactivatePlugin,
  uninstallPlugin,
  getPluginConfig,
  updatePluginConfig,
  pluginManager,
} from '../services/plugin.service';
import { schedulerManager } from '../lib/scheduler';
import { wcError } from '../lib/wc-error';

const router = new Hono();

// ============== VALIDATION SCHEMAS ==============

const UpdateConfigSchema = z.object({
  config: z.record(z.unknown()),
});

// ============== LIST PLUGINS ==============

/**
 * GET /plugins
 * List all installed plugins
 */
router.get('/', async (c) => {
  const pluginList = await listPlugins();
  
  return c.json({
    plugins: pluginList,
    total: pluginList.length,
  });
});

// ============== GET PLUGIN ==============

/**
 * GET /plugins/:id
 * Get a single plugin's state
 */
router.get('/:id', async (c) => {
  const pluginId = c.req.param('id');
  
  const state = await getPluginState(pluginId);
  
  if (!state) {
    return c.json(wcError(
      'woocommerce_rest_plugin_not_found',
      'Plugin not found.',
      404
    ), 404);
  }
  
  return c.json(state);
});

// ============== ACTIVATE PLUGIN ==============

/**
 * POST /plugins/:id/activate
 * Activate a plugin
 */
router.post('/:id/activate', async (c) => {
  const pluginId = c.req.param('id');
  
  try {
    const state = await activatePlugin(pluginId);
    return c.json(state);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not installed')) {
        return c.json(wcError(
          'woocommerce_rest_plugin_not_found',
          error.message,
          404
        ), 404);
      }
      return c.json(wcError(
        'woocommerce_rest_plugin_activation_error',
        error.message,
        400
      ), 400);
    }
    return c.json(wcError(
      'woocommerce_rest_plugin_activation_error',
      'Failed to activate plugin.',
      500
    ), 500);
  }
});

// ============== DEACTIVATE PLUGIN ==============

/**
 * POST /plugins/:id/deactivate
 * Deactivate a plugin
 */
router.post('/:id/deactivate', async (c) => {
  const pluginId = c.req.param('id');
  
  try {
    const state = await deactivatePlugin(pluginId);
    return c.json(state);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not installed')) {
        return c.json(wcError(
          'woocommerce_rest_plugin_not_found',
          error.message,
          404
        ), 404);
      }
      return c.json(wcError(
        'woocommerce_rest_plugin_deactivation_error',
        error.message,
        400
      ), 400);
    }
    return c.json(wcError(
      'woocommerce_rest_plugin_deactivation_error',
      'Failed to deactivate plugin.',
      500
    ), 500);
  }
});

// ============== UNINSTALL PLUGIN ==============

/**
 * DELETE /plugins/:id
 * Uninstall a plugin
 */
router.delete('/:id', async (c) => {
  const pluginId = c.req.param('id');
  
  try {
    await uninstallPlugin(pluginId);
    return c.json({ success: true, message: `Plugin ${pluginId} uninstalled.` });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not installed')) {
        return c.json(wcError(
          'woocommerce_rest_plugin_not_found',
          error.message,
          404
        ), 404);
      }
      return c.json(wcError(
        'woocommerce_rest_plugin_uninstall_error',
        error.message,
        400
      ), 400);
    }
    return c.json(wcError(
      'woocommerce_rest_plugin_uninstall_error',
      'Failed to uninstall plugin.',
      500
    ), 500);
  }
});

// ============== PLUGIN CONFIG ==============

/**
 * GET /plugins/:id/config
 * Get plugin configuration
 */
router.get('/:id/config', async (c) => {
  const pluginId = c.req.param('id');
  
  const state = await getPluginState(pluginId);
  
  if (!state) {
    return c.json(wcError(
      'woocommerce_rest_plugin_not_found',
      'Plugin not found.',
      404
    ), 404);
  }
  
  const config = await getPluginConfig(pluginId);
  
  return c.json({ pluginId, config });
});

/**
 * PUT /plugins/:id/config
 * Update plugin configuration
 */
router.put('/:id/config', async (c) => {
  const pluginId = c.req.param('id');
  
  const state = await getPluginState(pluginId);
  
  if (!state) {
    return c.json(wcError(
      'woocommerce_rest_plugin_not_found',
      'Plugin not found.',
      404
    ), 404);
  }
  
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateConfigSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json(wcError(
      'woocommerce_rest_invalid_param',
      'Invalid config format.',
      400
    ), 400);
  }
  
  await updatePluginConfig(pluginId, parsed.data.config);
  
  const updatedConfig = await getPluginConfig(pluginId);
  
  return c.json({ pluginId, config: updatedConfig });
});

// ============== PLUGIN LOGS ==============

/**
 * GET /plugins/:id/logs
 * Get plugin logs
 */
router.get('/:id/logs', async (c) => {
  const pluginId = c.req.param('id');
  const limit = parseInt(c.req.query('limit') ?? '100', 10);
  
  const state = await getPluginState(pluginId);
  
  if (!state) {
    return c.json(wcError(
      'woocommerce_rest_plugin_not_found',
      'Plugin not found.',
      404
    ), 404);
  }
  
  const logs = await pluginManager.getPluginLogs(pluginId, limit);
  
  return c.json({
    pluginId,
    logs,
    total: logs.length,
  });
});

// ============== PLUGIN SCHEDULES ==============

/**
 * GET /plugins/:id/schedules
 * Get plugin schedules
 */
router.get('/:id/schedules', async (c) => {
  const pluginId = c.req.param('id');
  
  const state = await getPluginState(pluginId);
  
  if (!state) {
    return c.json(wcError(
      'woocommerce_rest_plugin_not_found',
      'Plugin not found.',
      404
    ), 404);
  }
  
  const schedules = schedulerManager.getPluginSchedules(pluginId);
  
  return c.json({
    pluginId,
    schedules: schedules.map(s => ({
      id: s.scheduleId,
      cronExpression: s.cronExpression,
      intervalMs: s.intervalMs,
      nextRun: s.nextRun,
      isEnabled: s.isEnabled,
    })),
  });
});

/**
 * POST /plugins/:id/schedules/:scheduleId/run
 * Run a scheduled task manually
 */
router.post('/:id/schedules/:scheduleId/run', async (c) => {
  const pluginId = c.req.param('id');
  const scheduleId = c.req.param('scheduleId');
  
  const state = await getPluginState(pluginId);
  
  if (!state) {
    return c.json(wcError(
      'woocommerce_rest_plugin_not_found',
      'Plugin not found.',
      404
    ), 404);
  }
  
  try {
    await schedulerManager.runNow(pluginId, scheduleId);
    return c.json({ success: true, message: `Schedule ${scheduleId} executed.` });
  } catch {
    return c.json(wcError(
      'woocommerce_rest_schedule_error',
      'Failed to run schedule.',
      500
    ), 500);
  }
});

export default router;
