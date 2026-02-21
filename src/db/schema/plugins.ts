/**
 * Plugin System Database Schema
 */

import { pgTable, serial, varchar, text, boolean, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

// ============== PLUGINS TABLE ==============

export const plugins = pgTable('plugins', {
  id: varchar('id', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  description: text('description'),
  author: varchar('author', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('installed'), // installed, active, inactive, error
  isSystem: boolean('is_system').notNull().default(false),
  manifest: jsonb('manifest').notNull().$type<Record<string, unknown>>(),
  config: jsonb('config').notNull().$type<Record<string, unknown>>().default({}),
  lastError: text('last_error'),
  dateInstalled: timestamp('date_installed').notNull().defaultNow(),
  dateActivated: timestamp('date_activated'),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
});

// ============== PLUGIN SETTINGS TABLE ==============

export const pluginSettings = pgTable('plugin_settings', {
  id: serial('id').primaryKey(),
  pluginId: varchar('plugin_id', { length: 100 }).notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 255 }).notNull(),
  value: jsonb('value').notNull().$type<unknown>(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
});

// ============== PLUGIN LOGS TABLE ==============

export const pluginLogs = pgTable('plugin_logs', {
  id: serial('id').primaryKey(),
  pluginId: varchar('plugin_id', { length: 100 }).notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  level: varchar('level', { length: 20 }).notNull(), // info, warn, error, debug
  message: text('message').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

// ============== PLUGIN SCHEDULES TABLE ==============

export const pluginSchedules = pgTable('plugin_schedules', {
  id: serial('id').primaryKey(),
  pluginId: varchar('plugin_id', { length: 100 }).notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  scheduleId: varchar('schedule_id', { length: 100 }).notNull(),
  cronExpression: varchar('cron_expression', { length: 100 }),
  intervalMs: integer('interval_ms'),
  nextRun: timestamp('next_run'),
  lastRun: timestamp('last_run'),
  isRunning: boolean('is_running').notNull().default(false),
  isEnabled: boolean('is_enabled').notNull().default(true),
});

// ============== PLUGIN HOOKS TABLE ==============

export const pluginHooks = pgTable('plugin_hooks', {
  id: serial('id').primaryKey(),
  pluginId: varchar('plugin_id', { length: 100 }).notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  hookName: varchar('hook_name', { length: 100 }).notNull(),
  priority: integer('priority').notNull().default(10),
  isEnabled: boolean('is_enabled').notNull().default(true),
});

// ============== TYPES ==============

export type Plugin = typeof plugins.$inferSelect;
export type NewPlugin = typeof plugins.$inferInsert;
export type PluginSetting = typeof pluginSettings.$inferSelect;
export type NewPluginSetting = typeof pluginSettings.$inferInsert;
export type PluginLog = typeof pluginLogs.$inferSelect;
export type NewPluginLog = typeof pluginLogs.$inferInsert;
export type PluginSchedule = typeof pluginSchedules.$inferSelect;
export type NewPluginSchedule = typeof pluginSchedules.$inferInsert;
export type PluginHook = typeof pluginHooks.$inferSelect;
export type NewPluginHook = typeof pluginHooks.$inferInsert;
