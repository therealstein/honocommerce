/**
 * Settings Schema
 */

import { pgTable, serial, varchar, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  
  // Setting group
  group: varchar('group', { length: 50 }).notNull(),
  
  // Setting ID (e.g., woocommerce_currency)
  settingId: varchar('setting_id', { length: 100 }).notNull(),
  
  // Label
  label: varchar('label', { length: 255 }).notNull(),
  
  // Description
  description: text('description'),
  
  // Type: text, select, checkbox, etc.
  type: varchar('type', { length: 20 }).notNull().default('text'),
  
  // Default value
  defaultValue: text('default_value'),
  
  // Current value
  value: text('value'),
  
  // Options (for select type)
  options: jsonb('options').default({}),
  
  // Timestamps
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
});

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
