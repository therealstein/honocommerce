/**
 * Product Attribute Service
 */

import { db } from '../db';
import { 
  attributes, attributeTerms, 
  type Attribute, type NewAttribute,
  type AttributeTerm, type NewAttributeTerm 
} from '../db/schema/product-attributes';
import { eq, and, desc, asc, sql, like, inArray } from 'drizzle-orm';
import type { PaginationResult } from '../lib/pagination';
import { createPaginationResult } from '../lib/pagination';
import type { 
  CreateAttributeInput, UpdateAttributeInput, AttributeListQuery,
  CreateAttributeTermInput, UpdateAttributeTermInput, AttributeTermListQuery
} from '../validators/attribute.validators';

const generateSlug = (name: string): string => {
  return 'pa_' + name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const generateUniqueSlug = async (name: string, excludeId?: number): Promise<string> => {
  let slug = generateSlug(name);
  let counter = 0;
  
  while (true) {
    const conditions = [eq(attributes.slug, slug)];
    if (excludeId) {
      conditions.push(sql`${attributes.id} != ${excludeId}`);
    }
    
    const [existing] = await db
      .select({ id: attributes.id })
      .from(attributes)
      .where(and(...conditions))
      .limit(1);
    
    if (!existing) break;
    
    counter++;
    slug = `${generateSlug(name)}-${counter}`;
  }
  
  return slug;
};

const generateTermSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const generateUniqueTermSlug = async (attributeId: number, name: string, excludeId?: number): Promise<string> => {
  let slug = generateTermSlug(name);
  let counter = 0;
  
  while (true) {
    const conditions = [eq(attributeTerms.attributeId, attributeId), eq(attributeTerms.slug, slug)];
    if (excludeId) {
      conditions.push(sql`${attributeTerms.id} != ${excludeId}`);
    }
    
    const [existing] = await db
      .select({ id: attributeTerms.id })
      .from(attributeTerms)
      .where(and(...conditions))
      .limit(1);
    
    if (!existing) break;
    
    counter++;
    slug = `${generateTermSlug(name)}-${counter}`;
  }
  
  return slug;
};

// Attributes
export const listAttributes = async (
  params: AttributeListQuery
): Promise<PaginationResult<Attribute>> => {
  const { page, per_page, order, orderby, search, include, exclude } = params;
  
  const offset = (page - 1) * per_page;
  const conditions = [eq(attributes.isDeleted, false)];
  
  if (search) {
    conditions.push(like(attributes.name, `%${search}%`));
  }
  
  if (include && include.length > 0) {
    conditions.push(inArray(attributes.id, include));
  }
  
  if (exclude && exclude.length > 0) {
    conditions.push(sql`${attributes.id} NOT IN ${exclude}`);
  }
  
  const orderColumn = orderby === 'id' ? attributes.id 
    : orderby === 'title' ? attributes.name
    : orderby === 'slug' ? attributes.slug
    : attributes.dateCreated;
  
  const orderFn = order === 'asc' ? asc : desc;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attributes)
    .where(and(...conditions));
  
  const total = Number(count);
  
  const items = await db
    .select()
    .from(attributes)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(per_page)
    .offset(offset);
  
  return createPaginationResult(items, total, page, per_page);
};

export const getAttribute = async (id: number): Promise<Attribute | null> => {
  const [attribute] = await db
    .select()
    .from(attributes)
    .where(and(eq(attributes.id, id), eq(attributes.isDeleted, false)))
    .limit(1);
  
  return attribute ?? null;
};

export const createAttribute = async (input: CreateAttributeInput): Promise<Attribute> => {
  const slug = input.slug ?? await generateUniqueSlug(input.name);
  
  const newAttribute: NewAttribute = {
    name: input.name,
    slug,
    type: input.type ?? 'select',
    orderBy: input.order_by ?? 'menu_order',
    hasArchives: input.has_archives ?? false,
    dateCreated: new Date(),
    dateModified: new Date(),
    isDeleted: false,
  };
  
  const [attribute] = await db.insert(attributes).values(newAttribute).returning();
  
  return attribute;
};

export const updateAttribute = async (
  id: number,
  input: UpdateAttributeInput
): Promise<Attribute | null> => {
  const existing = await getAttribute(id);
  if (!existing) return null;
  
  const updateData: Partial<NewAttribute> = {
    dateModified: new Date(),
  };
  
  if (input.name !== undefined) {
    updateData.name = input.name;
    if (!input.slug) {
      updateData.slug = await generateUniqueSlug(input.name, id);
    }
  }
  
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.order_by !== undefined) updateData.orderBy = input.order_by;
  if (input.has_archives !== undefined) updateData.hasArchives = input.has_archives;
  
  const [attribute] = await db
    .update(attributes)
    .set(updateData)
    .where(and(eq(attributes.id, id), eq(attributes.isDeleted, false)))
    .returning();
  
  return attribute ?? null;
};

export const deleteAttribute = async (id: number, force = false): Promise<Attribute | null> => {
  const existing = await getAttribute(id);
  if (!existing) return null;
  
  // Also delete all terms for this attribute
  if (force) {
    await db.delete(attributeTerms).where(eq(attributeTerms.attributeId, id));
    await db.delete(attributes).where(eq(attributes.id, id));
    return existing;
  }
  
  // Soft delete attribute and terms
  await db
    .update(attributeTerms)
    .set({ isDeleted: true, dateModified: new Date() })
    .where(eq(attributeTerms.attributeId, id));
  
  const [attribute] = await db
    .update(attributes)
    .set({ 
      isDeleted: true, 
      dateModified: new Date(),
    })
    .where(eq(attributes.id, id))
    .returning();
  
  return attribute ?? null;
};

// Attribute Terms
export const listAttributeTerms = async (
  attributeId: number,
  params: AttributeTermListQuery
): Promise<PaginationResult<AttributeTerm>> => {
  const { page, per_page, order, orderby, search, include, exclude, hide_empty } = params;
  
  const offset = (page - 1) * per_page;
  const conditions = [
    eq(attributeTerms.attributeId, attributeId),
    eq(attributeTerms.isDeleted, false)
  ];
  
  if (search) {
    conditions.push(like(attributeTerms.name, `%${search}%`));
  }
  
  if (include && include.length > 0) {
    conditions.push(inArray(attributeTerms.id, include));
  }
  
  if (exclude && exclude.length > 0) {
    conditions.push(sql`${attributeTerms.id} NOT IN ${exclude}`);
  }
  
  const orderColumn = orderby === 'id' ? attributeTerms.id 
    : orderby === 'title' ? attributeTerms.name
    : orderby === 'slug' ? attributeTerms.slug
    : attributeTerms.dateCreated;
  
  const orderFn = order === 'asc' ? asc : desc;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attributeTerms)
    .where(and(...conditions));
  
  const total = Number(count);
  
  const items = await db
    .select()
    .from(attributeTerms)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(per_page)
    .offset(offset);
  
  let filteredItems = items;
  if (hide_empty) {
    filteredItems = items.filter(item => item.count > 0);
  }
  
  return createPaginationResult(filteredItems, total, page, per_page);
};

export const getAttributeTerm = async (attributeId: number, termId: number): Promise<AttributeTerm | null> => {
  const [term] = await db
    .select()
    .from(attributeTerms)
    .where(and(
      eq(attributeTerms.id, termId),
      eq(attributeTerms.attributeId, attributeId),
      eq(attributeTerms.isDeleted, false)
    ))
    .limit(1);
  
  return term ?? null;
};

export const createAttributeTerm = async (
  attributeId: number,
  input: CreateAttributeTermInput
): Promise<AttributeTerm> => {
  const slug = input.slug ?? await generateUniqueTermSlug(attributeId, input.name);
  
  const newTerm: NewAttributeTerm = {
    attributeId,
    name: input.name,
    slug,
    description: input.description ?? null,
    menuOrder: input.menu_order ?? 0,
    count: 0,
    dateCreated: new Date(),
    dateModified: new Date(),
    isDeleted: false,
  };
  
  const [term] = await db.insert(attributeTerms).values(newTerm).returning();
  
  return term;
};

export const updateAttributeTerm = async (
  attributeId: number,
  termId: number,
  input: UpdateAttributeTermInput
): Promise<AttributeTerm | null> => {
  const existing = await getAttributeTerm(attributeId, termId);
  if (!existing) return null;
  
  const updateData: Partial<NewAttributeTerm> = {
    dateModified: new Date(),
  };
  
  if (input.name !== undefined) {
    updateData.name = input.name;
    if (!input.slug) {
      updateData.slug = await generateUniqueTermSlug(attributeId, input.name, termId);
    }
  }
  
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.description !== undefined) updateData.description = input.description ?? null;
  if (input.menu_order !== undefined) updateData.menuOrder = input.menu_order;
  
  const [term] = await db
    .update(attributeTerms)
    .set(updateData)
    .where(and(
      eq(attributeTerms.id, termId),
      eq(attributeTerms.attributeId, attributeId),
      eq(attributeTerms.isDeleted, false)
    ))
    .returning();
  
  return term ?? null;
};

export const deleteAttributeTerm = async (
  attributeId: number,
  termId: number,
  force = false
): Promise<AttributeTerm | null> => {
  const existing = await getAttributeTerm(attributeId, termId);
  if (!existing) return null;
  
  if (force) {
    await db.delete(attributeTerms).where(eq(attributeTerms.id, termId));
    return existing;
  }
  
  const [term] = await db
    .update(attributeTerms)
    .set({ 
      isDeleted: true, 
      dateModified: new Date(),
    })
    .where(eq(attributeTerms.id, termId))
    .returning();
  
  return term ?? null;
};

export const attributeService = {
  list: listAttributes,
  get: getAttribute,
  create: createAttribute,
  update: updateAttribute,
  delete: deleteAttribute,
  // Terms
  listTerms: listAttributeTerms,
  getTerm: getAttributeTerm,
  createTerm: createAttributeTerm,
  updateTerm: updateAttributeTerm,
  deleteTerm: deleteAttributeTerm,
};

export default attributeService;
