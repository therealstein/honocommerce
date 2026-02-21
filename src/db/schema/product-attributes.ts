/**
 * Product Attributes Schema
 */

import { pgTable, serial, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';

export const attributes = pgTable('attributes', {
  id: serial('id').primaryKey(),
  
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  
  // Type: select
  type: varchar('type', { length: 20 }).notNull().default('select'),
  
  // Order by: menu_order, name, name_num, id
  orderBy: varchar('order_by', { length: 20 }).notNull().default('menu_order'),
  
  hasArchives: boolean('has_archives').notNull().default(false),
  
  // Timestamps
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
});

// Attribute terms (values)
export const attributeTerms = pgTable('attribute_terms', {
  id: serial('id').primaryKey(),
  
  attributeId: integer('attribute_id').notNull(),
  
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  
  description: text('description'),
  menuOrder: integer('menu_order').notNull().default(0),
  count: integer('count').notNull().default(0),
  
  // Timestamps
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
});

import { integer, text } from 'drizzle-orm/pg-core';

export type Attribute = typeof attributes.$inferSelect;
export type NewAttribute = typeof attributes.$inferInsert;
export type AttributeTerm = typeof attributeTerms.$inferSelect;
export type NewAttributeTerm = typeof attributeTerms.$inferInsert;
