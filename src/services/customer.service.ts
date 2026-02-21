/**
 * Customer Service
 */

import { db } from '../db';
import { customers, type Customer, type NewCustomer } from '../db/schema/customers';
import { orders } from '../db/schema/orders';
import { eq, and, desc, asc, sql, like, or, inArray, isNotNull } from 'drizzle-orm';
import type { PaginationResult } from '../lib/pagination';
import { createPaginationResult } from '../lib/pagination';
import type { CreateCustomerInput, UpdateCustomerInput, CustomerListQuery } from '../validators/customer.validators';

export const listCustomers = async (params: CustomerListQuery): Promise<PaginationResult<Customer>> => {
  const { page, per_page, order, orderby, search, include, exclude, role, email } = params;
  
  const offset = (page - 1) * per_page;
  const conditions = [eq(customers.isDeleted, false)];
  
  if (email) conditions.push(eq(customers.email, email));
  if (role) conditions.push(eq(customers.role, role));
  
  if (search) {
    conditions.push(or(
      like(customers.email, `%${search}%`),
      like(customers.firstName, `%${search}%`),
      like(customers.lastName, `%${search}%`)
    )!);
  }
  
  if (include && include.length > 0) conditions.push(inArray(customers.id, include));
  if (exclude && exclude.length > 0) conditions.push(sql`${customers.id} NOT IN ${exclude}`);
  
  const orderColumn = orderby === 'id' ? customers.id 
    : orderby === 'title' ? customers.email
    : customers.dateCreated;
  
  const orderFn = order === 'asc' ? asc : desc;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(and(...conditions));
  
  const total = Number(count);
  
  const items = await db
    .select()
    .from(customers)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(per_page)
    .offset(offset);
  
  return createPaginationResult(items, total, page, per_page);
};

export const getCustomer = async (id: number): Promise<Customer | null> => {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.isDeleted, false)))
    .limit(1);
  
  return customer ?? null;
};

export const getCustomerByEmail = async (email: string): Promise<Customer | null> => {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.email, email), eq(customers.isDeleted, false)))
    .limit(1);
  
  return customer ?? null;
};

export const createCustomer = async (input: CreateCustomerInput): Promise<Customer> => {
  const now = new Date();
  const newCustomer: NewCustomer = {
    email: input.email,
    firstName: input.first_name ?? null,
    lastName: input.last_name ?? null,
    username: input.username ?? null,
    role: input.role ?? 'customer',
    passwordHash: input.password ? await hashPassword(input.password) : null,
    billing: input.billing ?? {},
    shipping: input.shipping ?? {},
    isPayingCustomer: false,
    avatarUrl: null,
    metaData: input.meta_data ?? [],
    dateCreated: now,
    dateCreatedGmt: now,
    dateModified: now,
    dateModifiedGmt: now,
    isDeleted: false,
  };
  
  const [customer] = await db.insert(customers).values(newCustomer).returning();
  return customer;
};

export const updateCustomer = async (id: number, input: UpdateCustomerInput): Promise<Customer | null> => {
  const existing = await getCustomer(id);
  if (!existing) return null;
  
  const updateData: Partial<NewCustomer> = {
    dateModified: new Date(),
    dateModifiedGmt: new Date(),
  };
  
  if (input.email !== undefined) updateData.email = input.email;
  if (input.first_name !== undefined) updateData.firstName = input.first_name ?? null;
  if (input.last_name !== undefined) updateData.lastName = input.last_name ?? null;
  if (input.username !== undefined) updateData.username = input.username ?? null;
  if (input.password !== undefined) updateData.passwordHash = await hashPassword(input.password);
  if (input.role !== undefined) updateData.role = input.role;
  if (input.billing !== undefined) updateData.billing = input.billing;
  if (input.shipping !== undefined) updateData.shipping = input.shipping;
  if (input.meta_data !== undefined) updateData.metaData = input.meta_data ?? [];
  
  const [customer] = await db
    .update(customers)
    .set(updateData)
    .where(and(eq(customers.id, id), eq(customers.isDeleted, false)))
    .returning();
  
  return customer ?? null;
};

export const deleteCustomer = async (id: number, force = false): Promise<Customer | null> => {
  const existing = await getCustomer(id);
  if (!existing) return null;
  
  if (force) {
    await db.delete(customers).where(eq(customers.id, id));
    return existing;
  }
  
  const [customer] = await db
    .update(customers)
    .set({ isDeleted: true, dateModified: new Date(), dateModifiedGmt: new Date() })
    .where(eq(customers.id, id))
    .returning();
  
  return customer ?? null;
};

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'honocommerce_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const customerService = {
  list: listCustomers,
  get: getCustomer,
  getByEmail: getCustomerByEmail,
  create: createCustomer,
  update: updateCustomer,
  delete: deleteCustomer,
};

export default customerService;
