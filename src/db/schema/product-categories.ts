/**
 * Product Categories Schema
 */

import { pgTable, serial, varchar, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  
  parentId: integer('parent_id').notNull().default(0),
  description: text('description'),
  
  // Display type: default, products, subcategories, both
  display: varchar('display', { length: 20 }).notNull().default('default'),
  
  // Image
  image: jsonb('image'),
  
  menuOrder: integer('menu_order').notNull().default(0),
  count: integer('count').notNull().default(0),
  
  // Timestamps
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
