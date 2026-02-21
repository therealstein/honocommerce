/**
 * Shipping Schema
 */

import { pgTable, serial, varchar, timestamp, boolean, integer, jsonb, text } from 'drizzle-orm/pg-core';

// Shipping zones
export const shippingZones = pgTable('shipping_zones', {
  id: serial('id').primaryKey(),
  
  name: varchar('name', { length: 255 }).notNull(),
  order: integer('order').notNull().default(0),
  
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
});

// Shipping zone locations
export const shippingZoneLocations = pgTable('shipping_zone_locations', {
  id: serial('id').primaryKey(),
  zoneId: integer('zone_id').notNull(),
  
  // Code (country, state, postcode)
  code: varchar('code', { length: 100 }).notNull(),
  
  // Type: country, state, postcode, continent
  type: varchar('type', { length: 20 }).notNull(),
});

// Shipping zone methods
export const shippingZoneMethods = pgTable('shipping_zone_methods', {
  id: serial('id').primaryKey(),
  zoneId: integer('zone_id').notNull(),
  
  // Instance ID (unique per zone)
  instanceId: integer('instance_id').notNull(),
  
  // Method ID (flat_rate, free_shipping, local_pickup)
  methodId: varchar('method_id', { length: 50 }).notNull(),
  
  // Title (customer-facing)
  title: varchar('title', { length: 255 }).notNull(),
  
  // Order within zone
  order: integer('order').notNull().default(0),
  
  // Enabled
  enabled: boolean('enabled').notNull().default(true),
  
  // Method settings
  settings: jsonb('settings').notNull().default({}),
  
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
});

// Shipping classes
export const shippingClasses = pgTable('shipping_classes', {
  id: serial('id').primaryKey(),
  
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
});

export type ShippingZone = typeof shippingZones.$inferSelect;
export type NewShippingZone = typeof shippingZones.$inferInsert;
export type ShippingZoneMethod = typeof shippingZoneMethods.$inferSelect;
export type NewShippingZoneMethod = typeof shippingZoneMethods.$inferInsert;
export type ShippingClass = typeof shippingClasses.$inferSelect;
export type NewShippingClass = typeof shippingClasses.$inferInsert;
