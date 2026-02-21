/**
 * Shipping Routes
 * WooCommerce /shipping endpoint handlers
 */

import { Hono } from 'hono';
import { shippingService } from '../services/shipping.service';
import {
  formatShippingZoneResponse,
  formatShippingZoneListResponse,
  formatShippingZoneLocationResponse,
  formatShippingZoneLocationListResponse,
  formatShippingMethodResponse,
  formatShippingMethodListResponse,
} from '../lib/shipping-formatter';
import { wcError } from '../lib/wc-error';
import {
  createShippingZoneSchema,
  updateShippingZoneSchema,
  createShippingZoneLocationSchema,
  batchLocationsSchema,
  createShippingMethodSchema,
  updateShippingMethodSchema,
} from '../validators/shipping.validators';

const router = new Hono();

// ============== SHIPPING ZONES ==============

/**
 * GET /shipping/zones - List shipping zones
 */
router.get('/zones', async (c) => {
  const zones = await shippingService.listZones();
  return c.json(formatShippingZoneListResponse(zones));
});

/**
 * POST /shipping/zones - Create shipping zone
 */
router.post('/zones', async (c) => {
  const body = await c.req.json();
  const parsed = createShippingZoneSchema.parse(body);
  
  const zone = await shippingService.createZone(parsed);
  
  return c.json(formatShippingZoneResponse(zone), 201);
});

/**
 * GET /shipping/zones/:id - Get shipping zone
 */
router.get('/zones/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 400), 400);
  }
  
  const zone = await shippingService.getZone(id);
  
  if (!zone) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 404), 404);
  }
  
  return c.json(formatShippingZoneResponse(zone));
});

/**
 * PUT /shipping/zones/:id - Update shipping zone
 */
router.put('/zones/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 400), 400);
  }
  
  const body = await c.req.json();
  const parsed = updateShippingZoneSchema.parse(body);
  
  const zone = await shippingService.updateZone(id, parsed);
  
  if (!zone) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 404), 404);
  }
  
  return c.json(formatShippingZoneResponse(zone));
});

/**
 * DELETE /shipping/zones/:id - Delete shipping zone
 */
router.delete('/zones/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 400), 400);
  }
  
  const deleted = await shippingService.deleteZone(id);
  
  if (!deleted) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 404), 404);
  }
  
  return c.json({ id });
});

// ============== SHIPPING ZONE LOCATIONS ==============

/**
 * GET /shipping/zones/:id/locations - List zone locations
 */
router.get('/zones/:id/locations', async (c) => {
  const zoneId = parseInt(c.req.param('id'), 10);
  
  if (isNaN(zoneId)) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 400), 400);
  }
  
  const zone = await shippingService.getZone(zoneId);
  if (!zone) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 404), 404);
  }
  
  const locations = await shippingService.listZoneLocations(zoneId);
  
  return c.json(formatShippingZoneLocationListResponse(locations));
});

/**
 * POST /shipping/zones/:id/locations - Batch update zone locations
 * WooCommerce replaces all locations with the provided ones
 */
router.post('/zones/:id/locations', async (c) => {
  const zoneId = parseInt(c.req.param('id'), 10);
  
  if (isNaN(zoneId)) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 400), 400);
  }
  
  const zone = await shippingService.getZone(zoneId);
  if (!zone) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 404), 404);
  }
  
  const body = await c.req.json();
  
  // Body can be an array of locations or { create: [...] }
  let locations: Array<{ code: string; type: string }> = [];
  
  if (Array.isArray(body)) {
    locations = body.map(loc => createShippingZoneLocationSchema.parse(loc));
  } else {
    const parsed = batchLocationsSchema.parse(body);
    locations = parsed.create ?? [];
  }
  
  const created = await shippingService.batchCreateZoneLocations(zoneId, locations);
  
  return c.json(formatShippingZoneLocationListResponse(created), 201);
});

// ============== SHIPPING ZONE METHODS ==============

/**
 * GET /shipping/zones/:id/methods - List zone methods
 */
router.get('/zones/:id/methods', async (c) => {
  const zoneId = parseInt(c.req.param('id'), 10);
  
  if (isNaN(zoneId)) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 400), 400);
  }
  
  const zone = await shippingService.getZone(zoneId);
  if (!zone) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 404), 404);
  }
  
  const methods = await shippingService.listZoneMethods(zoneId);
  
  return c.json(formatShippingMethodListResponse(methods, zoneId));
});

/**
 * POST /shipping/zones/:id/methods - Add method to zone
 */
router.post('/zones/:id/methods', async (c) => {
  const zoneId = parseInt(c.req.param('id'), 10);
  
  if (isNaN(zoneId)) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 400), 400);
  }
  
  const zone = await shippingService.getZone(zoneId);
  if (!zone) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 404), 404);
  }
  
  const body = await c.req.json();
  const parsed = createShippingMethodSchema.parse(body);
  
  const method = await shippingService.createZoneMethod(zoneId, parsed);
  
  return c.json(formatShippingMethodResponse(method, zoneId), 201);
});

/**
 * GET /shipping/zones/:id/methods/:instance_id - Get zone method
 */
router.get('/zones/:id/methods/:instance_id', async (c) => {
  const zoneId = parseInt(c.req.param('id'), 10);
  const instanceId = parseInt(c.req.param('instance_id'), 10);
  
  if (isNaN(zoneId)) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 400), 400);
  }
  
  if (isNaN(instanceId)) {
    return c.json(wcError('shipping_method_invalid_id', 'Invalid shipping method instance ID.', 400), 400);
  }
  
  const method = await shippingService.getZoneMethod(zoneId, instanceId);
  
  if (!method) {
    return c.json(wcError('shipping_method_invalid_id', 'Invalid shipping method instance ID.', 404), 404);
  }
  
  return c.json(formatShippingMethodResponse(method, zoneId));
});

/**
 * PUT /shipping/zones/:id/methods/:instance_id - Update zone method
 */
router.put('/zones/:id/methods/:instance_id', async (c) => {
  const zoneId = parseInt(c.req.param('id'), 10);
  const instanceId = parseInt(c.req.param('instance_id'), 10);
  
  if (isNaN(zoneId)) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 400), 400);
  }
  
  if (isNaN(instanceId)) {
    return c.json(wcError('shipping_method_invalid_id', 'Invalid shipping method instance ID.', 400), 400);
  }
  
  const body = await c.req.json();
  const parsed = updateShippingMethodSchema.parse(body);
  
  const method = await shippingService.updateZoneMethod(zoneId, instanceId, parsed);
  
  if (!method) {
    return c.json(wcError('shipping_method_invalid_id', 'Invalid shipping method instance ID.', 404), 404);
  }
  
  return c.json(formatShippingMethodResponse(method, zoneId));
});

/**
 * DELETE /shipping/zones/:id/methods/:instance_id - Delete zone method
 */
router.delete('/zones/:id/methods/:instance_id', async (c) => {
  const zoneId = parseInt(c.req.param('id'), 10);
  const instanceId = parseInt(c.req.param('instance_id'), 10);
  
  if (isNaN(zoneId)) {
    return c.json(wcError('shipping_zone_invalid_id', 'Invalid shipping zone ID.', 400), 400);
  }
  
  if (isNaN(instanceId)) {
    return c.json(wcError('shipping_method_invalid_id', 'Invalid shipping method instance ID.', 400), 400);
  }
  
  const deleted = await shippingService.deleteZoneMethod(zoneId, instanceId);
  
  if (!deleted) {
    return c.json(wcError('shipping_method_invalid_id', 'Invalid shipping method instance ID.', 404), 404);
  }
  
  return c.json({ instance_id: instanceId });
});

export default router;
