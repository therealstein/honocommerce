/**
 * Settings Routes
 * WooCommerce /settings endpoint handlers
 */

import { Hono } from 'hono';
import { settingService } from '../services/setting.service';
import { wcError } from '../lib/wc-error';
import { z } from 'zod';

const router = new Hono();

// Validation schemas
const updateSettingSchema = z.object({
  value: z.string(),
});

const batchSettingsSchema = z.object({
  update: z.array(z.object({
    id: z.string(),
    value: z.string(),
  })).optional(),
});

/**
 * GET /settings - List settings groups
 */
router.get('/', async (c) => {
  const groups = settingService.getGroups();
  
  return c.json(groups.map(g => ({
    id: g.id,
    label: g.label,
    description: g.description,
    _links: {
      self: [{ href: `/wp-json/wc/v3/settings/${g.id}` }],
      collection: [{ href: '/wp-json/wc/v3/settings' }],
    },
  })));
});

/**
 * GET /settings/:group - Get settings group
 * Note: This must come AFTER specific routes like /batch
 */
router.get('/:group', async (c) => {
  const group = c.req.param('group');
  
  const settingsGroup = await settingService.getGroup(group);
  
  if (!settingsGroup) {
    return c.json(wcError('setting_group_invalid', 'Invalid setting group.', 404), 404);
  }
  
  return c.json({
    id: settingsGroup.id,
    label: settingsGroup.label,
    description: settingsGroup.description,
    settings: settingsGroup.settings,
    _links: {
      self: [{ href: `/wp-json/wc/v3/settings/${group}` }],
      collection: [{ href: '/wp-json/wc/v3/settings' }],
    },
  });
});

/**
 * GET /settings/:group/:id - Get single setting
 */
router.get('/:group/:id', async (c) => {
  const group = c.req.param('group');
  const id = c.req.param('id');
  
  // Check if this is actually a batch request
  if (id === 'batch') {
    // This shouldn't happen with GET, but handle gracefully
    return c.json(wcError('rest_invalid_method', 'Use POST for batch operations.', 405), 405);
  }
  
  const setting = await settingService.get(group, id);
  
  if (!setting) {
    return c.json(wcError('setting_invalid', 'Invalid setting.', 404), 404);
  }
  
  return c.json(setting);
});

/**
 * PUT /settings/:group/:id - Update setting
 */
router.put('/:group/:id', async (c) => {
  const group = c.req.param('group');
  const id = c.req.param('id');
  
  const body = await c.req.json();
  const parsed = updateSettingSchema.parse(body);
  
  const setting = await settingService.update(group, id, parsed.value);
  
  if (!setting) {
    return c.json(wcError('setting_invalid', 'Invalid setting.', 404), 404);
  }
  
  return c.json(setting);
});

/**
 * POST /settings/:group/batch - Batch update settings
 */
router.post('/:group/batch', async (c) => {
  const group = c.req.param('group');
  
  // Verify group exists
  const settingsGroup = await settingService.getGroup(group);
  if (!settingsGroup) {
    return c.json(wcError('setting_group_invalid', 'Invalid setting group.', 404), 404);
  }
  
  const body = await c.req.json();
  const parsed = batchSettingsSchema.parse(body);
  
  const updated: Array<{ id: string; value: string }> = [];
  
  if (parsed.update) {
    for (const item of parsed.update) {
      const result = await settingService.update(group, item.id, item.value);
      if (result) {
        updated.push({ id: item.id, value: item.value });
      }
    }
  }
  
  return c.json({ update: updated });
});

export default router;
