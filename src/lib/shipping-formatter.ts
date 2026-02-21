/**
 * Shipping Formatter
 */

import type { ShippingZone, ShippingZoneMethod, ShippingClass } from '../db/schema/shipping';
import type { shippingZoneLocations } from '../db/schema/shipping';
import { buildLinks } from './wc-response';

// ============== SHIPPING ZONE ==============

export interface ShippingZoneResponse {
  id: number;
  name: string;
  order: number;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatShippingZoneResponse = (zone: ShippingZone): ShippingZoneResponse => ({
  id: zone.id,
  name: zone.name,
  order: zone.order,
  _links: buildLinks(
    `/wp-json/wc/v3/shipping/zones/${zone.id}`,
    '/wp-json/wc/v3/shipping/zones'
  ),
});

export const formatShippingZoneListResponse = (zones: ShippingZone[]): ShippingZoneResponse[] =>
  zones.map(formatShippingZoneResponse);

// ============== SHIPPING ZONE LOCATION ==============

export interface ShippingZoneLocationResponse {
  code: string;
  type: string;
}

export const formatShippingZoneLocationResponse = (
  location: typeof shippingZoneLocations.$inferSelect
): ShippingZoneLocationResponse => ({
  code: location.code,
  type: location.type,
});

export const formatShippingZoneLocationListResponse = (
  locations: typeof shippingZoneLocations.$inferSelect[]
): ShippingZoneLocationResponse[] =>
  locations.map(formatShippingZoneLocationResponse);

// ============== SHIPPING METHOD ==============

export interface ShippingMethodResponse {
  instance_id: number;
  title: string;
  order: number;
  enabled: boolean;
  method_id: string;
  method_title: string;
  method_description: string;
  settings: Record<string, unknown>;
  _links: Record<string, Array<{ href: string }>>;
}

const methodDescriptions: Record<string, string> = {
  flat_rate: 'Lets you charge a fixed rate for shipping.',
  free_shipping: 'Free shipping is a special method which can be triggered with coupons and minimum spends.',
  local_pickup: 'Allow customers to pick up orders themselves.',
};

const methodTitles: Record<string, string> = {
  flat_rate: 'Flat rate',
  free_shipping: 'Free shipping',
  local_pickup: 'Local pickup',
};

export const formatShippingMethodResponse = (
  method: ShippingZoneMethod,
  zoneId: number
): ShippingMethodResponse => ({
  instance_id: method.instanceId,
  title: method.title,
  order: method.order,
  enabled: method.enabled,
  method_id: method.methodId,
  method_title: methodTitles[method.methodId] ?? method.methodId,
  method_description: methodDescriptions[method.methodId] ?? '',
  settings: method.settings as Record<string, unknown>,
  _links: buildLinks(
    `/wp-json/wc/v3/shipping/zones/${zoneId}/methods/${method.instanceId}`,
    `/wp-json/wc/v3/shipping/zones/${zoneId}/methods`
  ),
});

export const formatShippingMethodListResponse = (
  methods: ShippingZoneMethod[],
  zoneId: number
): ShippingMethodResponse[] =>
  methods.map(m => formatShippingMethodResponse(m, zoneId));

// ============== SHIPPING CLASS ==============

export interface ShippingClassResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatShippingClassResponse = (shippingClass: ShippingClass): ShippingClassResponse => ({
  id: shippingClass.id,
  name: shippingClass.name,
  slug: shippingClass.slug,
  description: shippingClass.description,
  _links: buildLinks(
    `/wp-json/wc/v3/products/shipping_classes/${shippingClass.id}`,
    '/wp-json/wc/v3/products/shipping_classes'
  ),
});

export const formatShippingClassListResponse = (classes: ShippingClass[]): ShippingClassResponse[] =>
  classes.map(formatShippingClassResponse);
