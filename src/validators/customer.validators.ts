/**
 * Customer Validation Schemas
 */

import { z } from 'zod';
import { listQuerySchema } from '../lib/pagination';

export const customerRoleSchema = z.enum(['customer', 'administrator', 'editor', 'author', 'contributor', 'subscriber']);

export const addressSchema = z.object({
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  company: z.string().optional().default(''),
  address_1: z.string().optional().default(''),
  address_2: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  postcode: z.string().optional().default(''),
  country: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().default(''),
});

export const shippingAddressSchema = z.object({
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  company: z.string().optional().default(''),
  address_1: z.string().optional().default(''),
  address_2: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  postcode: z.string().optional().default(''),
  country: z.string().optional().default(''),
});

export const createCustomerSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(8).optional(),
  role: customerRoleSchema.optional().default('customer'),
  billing: addressSchema.optional(),
  shipping: shippingAddressSchema.optional(),
  meta_data: z.array(z.object({ key: z.string(), value: z.unknown() })).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerListQuerySchema = listQuerySchema.extend({
  role: customerRoleSchema.optional(),
  email: z.string().optional(),
});

export const batchCustomersSchema = z.object({
  create: z.array(createCustomerSchema).optional(),
  update: z.array(updateCustomerSchema.extend({ id: z.number().int() })).optional(),
  delete: z.array(z.number().int()).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type BatchCustomersInput = z.infer<typeof batchCustomersSchema>;
