/**
 * Taxes Schema
 */

import { pgTable, serial, varchar, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

// Tax rates
export const taxRates = pgTable('tax_rates', {
  id: serial('id').primaryKey(),
  
  // Country code (ISO 3166-1 alpha-2)
  country: varchar('country', { length: 2 }).notNull().default(''),
  
  // State code
  state: varchar('state', { length: 50 }).notNull().default(''),
  
  // Postcode/ZIP
  postcode: varchar('postcode', { length: 100 }).notNull().default(''),
  
  // City
  city: varchar('city', { length: 100 }).notNull().default(''),
  
  // Rate (percentage)
  rate: varchar('rate', { length: 20 }).notNull(),
  
  // Name
  name: varchar('name', { length: 100 }).notNull(),
  
  // Priority (lower = higher priority)
  priority: integer('priority').notNull().default(1),
  
  // Compound
  compound: boolean('compound').notNull().default(false),
  
  // Shipping taxable
  shipping: boolean('shipping').notNull().default(true),
  
  // Order
  order: integer('order').notNull().default(0),
  
  // Tax class
  taxClass: varchar('tax_class', { length: 50 }).notNull().default(''),
  
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
});

// Tax classes
export const taxClasses = pgTable('tax_classes', {
  id: serial('id').primaryKey(),
  
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  
  dateCreated: timestamp('date_created').notNull().defaultNow(),
});

export type TaxRate = typeof taxRates.$inferSelect;
export type NewTaxRate = typeof taxRates.$inferInsert;
export type TaxClass = typeof taxClasses.$inferSelect;
export type NewTaxClass = typeof taxClasses.$inferInsert;
