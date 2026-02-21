/**
 * Product Tags Schema
 */

import { pgTable, serial, varchar, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  
  description: text('description'),
  count: integer('count').notNull().default(0),
  
  // Timestamps
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
});

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
