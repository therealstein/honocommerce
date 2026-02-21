/**
 * Taxes Service
 * Business logic for tax operations
 */

import { db } from '../db';
import { taxRates, taxClasses, type TaxRate, type NewTaxRate, type TaxClass, type NewTaxClass } from '../db/schema/taxes';
import { eq, and, desc, asc, sql, like } from 'drizzle-orm';
import type { ListQueryParams, PaginationResult } from '../lib/pagination';
import { createPaginationResult } from '../lib/pagination';

// ============== TAX RATES ==============

export const listTaxRates = async (
  params: ListQueryParams & { class?: string }
): Promise<PaginationResult<TaxRate>> => {
  const { page, per_page, order, orderby, search, class: taxClass } = params;
  
  const offset = (page - 1) * per_page;
  
  const conditions = [];
  
  if (search) {
    conditions.push(like(taxRates.name, `%${search}%`));
  }
  
  if (taxClass) {
    conditions.push(eq(taxRates.taxClass, taxClass));
  }
  
  const orderColumn = orderby === 'id' ? taxRates.id : taxRates.order;
  const orderFn = order === 'asc' ? asc : desc;
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(taxRates)
    .where(whereClause);
  
  const total = Number(count);
  
  const items = await db
    .select()
    .from(taxRates)
    .where(whereClause)
    .orderBy(orderFn(orderColumn))
    .limit(per_page)
    .offset(offset);
  
  return createPaginationResult(items, total, page, per_page);
};

export const getTaxRate = async (id: number): Promise<TaxRate | null> => {
  const [rate] = await db
    .select()
    .from(taxRates)
    .where(eq(taxRates.id, id))
    .limit(1);
  
  return rate ?? null;
};

export const createTaxRate = async (input: {
  country?: string;
  state?: string;
  postcode?: string;
  city?: string;
  rate: string;
  name: string;
  priority?: number;
  compound?: boolean;
  shipping?: boolean;
  order?: number;
  class?: string;
}): Promise<TaxRate> => {
  const [rate] = await db
    .insert(taxRates)
    .values({
      country: input.country ?? '',
      state: input.state ?? '',
      postcode: input.postcode ?? '',
      city: input.city ?? '',
      rate: input.rate,
      name: input.name,
      priority: input.priority ?? 1,
      compound: input.compound ?? false,
      shipping: input.shipping ?? true,
      order: input.order ?? 0,
      taxClass: input.class ?? '',
    })
    .returning();
  
  return rate;
};

export const updateTaxRate = async (
  id: number,
  input: {
    country?: string;
    state?: string;
    postcode?: string;
    city?: string;
    rate?: string;
    name?: string;
    priority?: number;
    compound?: boolean;
    shipping?: boolean;
    order?: number;
    class?: string;
  }
): Promise<TaxRate | null> => {
  const updateData: Partial<NewTaxRate> = {
    dateModified: new Date(),
  };
  
  if (input.country !== undefined) updateData.country = input.country;
  if (input.state !== undefined) updateData.state = input.state;
  if (input.postcode !== undefined) updateData.postcode = input.postcode;
  if (input.city !== undefined) updateData.city = input.city;
  if (input.rate !== undefined) updateData.rate = input.rate;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.compound !== undefined) updateData.compound = input.compound;
  if (input.shipping !== undefined) updateData.shipping = input.shipping;
  if (input.order !== undefined) updateData.order = input.order;
  if (input.class !== undefined) updateData.taxClass = input.class;
  
  const [rate] = await db
    .update(taxRates)
    .set(updateData)
    .where(eq(taxRates.id, id))
    .returning();
  
  return rate ?? null;
};

export const deleteTaxRate = async (id: number): Promise<boolean> => {
  const result = await db.delete(taxRates).where(eq(taxRates.id, id));
  return result.rowCount !== null && result.rowCount > 0;
};

// ============== TAX CLASSES ==============

// Default tax classes
const defaultTaxClasses = [
  { slug: 'standard', name: 'Standard Rate' },
  { slug: 'reduced-rate', name: 'Reduced Rate' },
  { slug: 'zero-rate', name: 'Zero Rate' },
];

export const listTaxClasses = async (): Promise<TaxClass[]> => {
  const dbClasses = await db.select().from(taxClasses);
  
  // Merge with defaults
  const merged = [...defaultTaxClasses];
  
  for (const dbClass of dbClasses) {
    if (!merged.find(c => c.slug === dbClass.slug)) {
      merged.push({ slug: dbClass.slug, name: dbClass.name });
    }
  }
  
  // Return as TaxClass type (need to add id)
  return dbClasses.length > 0 ? dbClasses : defaultTaxClasses.map((c, i) => ({
    id: i + 1,
    slug: c.slug,
    name: c.name,
    dateCreated: new Date(),
  }));
};

export const createTaxClass = async (input: { name: string; slug?: string }): Promise<TaxClass> => {
  const slug = input.slug ?? input.name.toLowerCase().replace(/\s+/g, '-');
  
  const [taxClass] = await db
    .insert(taxClasses)
    .values({
      slug,
      name: input.name,
    })
    .returning();
  
  return taxClass;
};

export const deleteTaxClass = async (slug: string): Promise<boolean> => {
  // Don't delete default classes
  if (['standard', 'reduced-rate', 'zero-rate'].includes(slug)) {
    return false;
  }
  
  const result = await db.delete(taxClasses).where(eq(taxClasses.slug, slug));
  return result.rowCount !== null && result.rowCount > 0;
};

// ============== SERVICE EXPORT ==============

export const taxService = {
  // Rates
  listRates: listTaxRates,
  getRate: getTaxRate,
  createRate: createTaxRate,
  updateRate: updateTaxRate,
  deleteRate: deleteTaxRate,
  
  // Classes
  listClasses: listTaxClasses,
  createClass: createTaxClass,
  deleteClass: deleteTaxClass,
};

export default taxService;
