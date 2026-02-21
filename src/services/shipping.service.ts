/**
 * Shipping Service
 * Business logic for shipping operations
 */

import { db } from '../db';
import {
  shippingZones,
  shippingZoneLocations,
  shippingZoneMethods,
  shippingClasses,
  type ShippingZone,
  type NewShippingZone,
  type ShippingZoneMethod,
  type NewShippingZoneMethod,
  type ShippingClass,
  type NewShippingClass,
} from '../db/schema/shipping';
import { eq, and, asc } from 'drizzle-orm';

// ============== SHIPPING ZONES ==============

export const listShippingZones = async (): Promise<ShippingZone[]> => {
  return db
    .select()
    .from(shippingZones)
    .orderBy(asc(shippingZones.order));
};

export const getShippingZone = async (id: number): Promise<ShippingZone | null> => {
  const [zone] = await db
    .select()
    .from(shippingZones)
    .where(eq(shippingZones.id, id))
    .limit(1);
  
  return zone ?? null;
};

export const createShippingZone = async (input: { name: string; order?: number }): Promise<ShippingZone> => {
  const [zone] = await db
    .insert(shippingZones)
    .values({
      name: input.name,
      order: input.order ?? 0,
    })
    .returning();
  
  return zone;
};

export const updateShippingZone = async (
  id: number,
  input: { name?: string; order?: number }
): Promise<ShippingZone | null> => {
  const [zone] = await db
    .update(shippingZones)
    .set({
      ...input,
      dateModified: new Date(),
    })
    .where(eq(shippingZones.id, id))
    .returning();
  
  return zone ?? null;
};

export const deleteShippingZone = async (id: number): Promise<boolean> => {
  // Delete associated methods and locations first
  await db.delete(shippingZoneMethods).where(eq(shippingZoneMethods.zoneId, id));
  await db.delete(shippingZoneLocations).where(eq(shippingZoneLocations.zoneId, id));
  
  const result = await db.delete(shippingZones).where(eq(shippingZones.id, id));
  return result.rowCount !== null && result.rowCount > 0;
};

// ============== SHIPPING ZONE LOCATIONS ==============

export const listShippingZoneLocations = async (zoneId: number) => {
  return db
    .select()
    .from(shippingZoneLocations)
    .where(eq(shippingZoneLocations.zoneId, zoneId));
};

export const createShippingZoneLocation = async (
  zoneId: number,
  input: { code: string; type: string }
) => {
  const [location] = await db
    .insert(shippingZoneLocations)
    .values({
      zoneId,
      code: input.code,
      type: input.type,
    })
    .returning();
  
  return location;
};

export const batchCreateShippingZoneLocations = async (
  zoneId: number,
  locations: Array<{ code: string; type: string }>
) => {
  // First, delete existing locations
  await db.delete(shippingZoneLocations).where(eq(shippingZoneLocations.zoneId, zoneId));
  
  // Then create new ones
  if (locations.length === 0) return [];
  
  return db
    .insert(shippingZoneLocations)
    .values(locations.map(loc => ({
      zoneId,
      code: loc.code,
      type: loc.type,
    })))
    .returning();
};

// ============== SHIPPING ZONE METHODS ==============

export const listShippingZoneMethods = async (zoneId: number): Promise<ShippingZoneMethod[]> => {
  return db
    .select()
    .from(shippingZoneMethods)
    .where(eq(shippingZoneMethods.zoneId, zoneId))
    .orderBy(asc(shippingZoneMethods.order));
};

export const getShippingZoneMethod = async (
  zoneId: number,
  instanceId: number
): Promise<ShippingZoneMethod | null> => {
  const [method] = await db
    .select()
    .from(shippingZoneMethods)
    .where(and(
      eq(shippingZoneMethods.zoneId, zoneId),
      eq(shippingZoneMethods.instanceId, instanceId)
    ))
    .limit(1);
  
  return method ?? null;
};

export const createShippingZoneMethod = async (
  zoneId: number,
  input: { method_id: string; order?: number; enabled?: boolean; settings?: Record<string, unknown> }
): Promise<ShippingZoneMethod> => {
  // Get next instance ID for this zone
  const existingMethods = await db
    .select({ instanceId: shippingZoneMethods.instanceId })
    .from(shippingZoneMethods)
    .where(eq(shippingZoneMethods.zoneId, zoneId));
  
  const maxInstanceId = existingMethods.reduce(
    (max, m) => Math.max(max, m.instanceId),
    0
  );
  const instanceId = maxInstanceId + 1;
  
  // Get method title based on method_id
  const methodTitles: Record<string, string> = {
    flat_rate: 'Flat rate',
    free_shipping: 'Free shipping',
    local_pickup: 'Local pickup',
  };
  
  const [method] = await db
    .insert(shippingZoneMethods)
    .values({
      zoneId,
      instanceId,
      methodId: input.method_id,
      title: methodTitles[input.method_id] ?? input.method_id,
      order: input.order ?? 0,
      enabled: input.enabled ?? true,
      settings: input.settings ?? getDefaultSettings(input.method_id),
    })
    .returning();
  
  return method;
};

const getDefaultSettings = (methodId: string): Record<string, unknown> => {
  switch (methodId) {
    case 'flat_rate':
      return {
        title: { id: 'title', label: 'Method title', type: 'text', value: 'Flat rate', default: 'Flat rate' },
        cost: { id: 'cost', label: 'Cost', type: 'text', value: '10', default: '' },
      };
    case 'free_shipping':
      return {
        title: { id: 'title', label: 'Method title', type: 'text', value: 'Free shipping', default: 'Free shipping' },
        requires_free_shipping_coupon: { id: 'requires_free_shipping_coupon', label: 'Free shipping requires coupon', type: 'checkbox', value: 'no', default: 'no' },
      };
    case 'local_pickup':
      return {
        title: { id: 'title', label: 'Method title', type: 'text', value: 'Local pickup', default: 'Local pickup' },
        cost: { id: 'cost', label: 'Cost', type: 'text', value: '0', default: '' },
      };
    default:
      return {};
  }
};

export const updateShippingZoneMethod = async (
  zoneId: number,
  instanceId: number,
  input: { title?: string; order?: number; enabled?: boolean; settings?: Record<string, unknown> }
): Promise<ShippingZoneMethod | null> => {
  const [method] = await db
    .update(shippingZoneMethods)
    .set({
      ...input,
      dateModified: new Date(),
    })
    .where(and(
      eq(shippingZoneMethods.zoneId, zoneId),
      eq(shippingZoneMethods.instanceId, instanceId)
    ))
    .returning();
  
  return method ?? null;
};

export const deleteShippingZoneMethod = async (
  zoneId: number,
  instanceId: number
): Promise<boolean> => {
  const result = await db
    .delete(shippingZoneMethods)
    .where(and(
      eq(shippingZoneMethods.zoneId, zoneId),
      eq(shippingZoneMethods.instanceId, instanceId)
    ));
  
  return result.rowCount !== null && result.rowCount > 0;
};

// ============== SHIPPING CLASSES ==============

export const listShippingClasses = async (): Promise<ShippingClass[]> => {
  return db.select().from(shippingClasses);
};

export const getShippingClass = async (id: number): Promise<ShippingClass | null> => {
  const [shippingClass] = await db
    .select()
    .from(shippingClasses)
    .where(eq(shippingClasses.id, id))
    .limit(1);
  
  return shippingClass ?? null;
};

export const createShippingClass = async (
  input: { name: string; slug?: string; description?: string }
): Promise<ShippingClass> => {
  const slug = input.slug ?? input.name.toLowerCase().replace(/\s+/g, '-');
  
  const [shippingClass] = await db
    .insert(shippingClasses)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
    })
    .returning();
  
  return shippingClass;
};

export const updateShippingClass = async (
  id: number,
  input: { name?: string; slug?: string; description?: string }
): Promise<ShippingClass | null> => {
  const [shippingClass] = await db
    .update(shippingClasses)
    .set({
      ...input,
      dateModified: new Date(),
    })
    .where(eq(shippingClasses.id, id))
    .returning();
  
  return shippingClass ?? null;
};

export const deleteShippingClass = async (id: number): Promise<boolean> => {
  const result = await db.delete(shippingClasses).where(eq(shippingClasses.id, id));
  return result.rowCount !== null && result.rowCount > 0;
};

// ============== SERVICE EXPORT ==============

export const shippingService = {
  // Zones
  listZones: listShippingZones,
  getZone: getShippingZone,
  createZone: createShippingZone,
  updateZone: updateShippingZone,
  deleteZone: deleteShippingZone,
  
  // Locations
  listZoneLocations: listShippingZoneLocations,
  createZoneLocation: createShippingZoneLocation,
  batchCreateZoneLocations: batchCreateShippingZoneLocations,
  
  // Methods
  listZoneMethods: listShippingZoneMethods,
  getZoneMethod: getShippingZoneMethod,
  createZoneMethod: createShippingZoneMethod,
  updateZoneMethod: updateShippingZoneMethod,
  deleteZoneMethod: deleteShippingZoneMethod,
  
  // Classes
  listClasses: listShippingClasses,
  getClass: getShippingClass,
  createClass: createShippingClass,
  updateClass: updateShippingClass,
  deleteClass: deleteShippingClass,
};

export default shippingService;
