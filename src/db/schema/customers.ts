/**
 * Customers Schema
 */

import { pgTable, serial, varchar, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  
  // Date created
  dateCreated: timestamp('date_created').notNull().defaultNow(),
  dateCreatedGmt: timestamp('date_created_gmt').notNull().defaultNow(),
  dateModified: timestamp('date_modified').notNull().defaultNow(),
  dateModifiedGmt: timestamp('date_modified_gmt').notNull().defaultNow(),
  
  // Email (required, unique)
  email: varchar('email', { length: 255 }).notNull().unique(),
  
  // Name
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  
  // Role
  role: varchar('role', { length: 50 }).notNull().default('customer'),
  
  // Username
  username: varchar('username', { length: 100 }).unique(),
  
  // Password hash
  passwordHash: varchar('password_hash', { length: 255 }),
  
  // Billing address
  billing: jsonb('billing').notNull().$type<{
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  }>(),
  
  // Shipping address
  shipping: jsonb('shipping').notNull().$type<{
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  }>(),
  
  // Is paying customer
  isPayingCustomer: boolean('is_paying_customer').notNull().default(false),
  
  // Avatar URL
  avatarUrl: varchar('avatar_url', { length: 500 }),
  
  // Meta data
  metaData: jsonb('meta_data').notNull().default([]),
  
  // Soft delete
  isDeleted: boolean('is_deleted').notNull().default(false),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
