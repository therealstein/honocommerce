/**
 * Product Category Service
 */

import { db } from '../db';
import { categories, type Category, type NewCategory } from '../db/schema/product-categories';
import { eq, and, desc, asc, sql, like, inArray } from 'drizzle-orm';
import type { PaginationResult } from '../lib/pagination';
import { createPaginationResult } from '../lib/pagination';
import type { CreateCategoryInput, UpdateCategoryInput, CategoryListQuery } from '../validators/category.validators';

const generateSlug = (name: string): string => {
  return name
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
    const conditions = [eq(categories.slug, slug)];
    if (excludeId) {
      conditions.push(sql`${categories.id} != ${excludeId}`);
    }
    
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(...conditions))
      .limit(1);
    
    if (!existing) break;
    
    counter++;
    slug = `${generateSlug(name)}-${counter}`;
  }
  
  return slug;
};

export const listCategories = async (
  params: CategoryListQuery
): Promise<PaginationResult<Category>> => {
  const { page, per_page, order, orderby, search, include, exclude, parent, hide_empty } = params;
  
  const offset = (page - 1) * per_page;
  const conditions = [eq(categories.isDeleted, false)];
  
  if (search) {
    conditions.push(like(categories.name, `%${search}%`));
  }
  
  if (include && include.length > 0) {
    conditions.push(inArray(categories.id, include));
  }
  
  if (exclude && exclude.length > 0) {
    conditions.push(sql`${categories.id} NOT IN ${exclude}`);
  }
  
  if (parent !== undefined) {
    conditions.push(eq(categories.parentId, parent));
  }
  
  const orderColumn = orderby === 'id' ? categories.id 
    : orderby === 'title' ? categories.name
    : orderby === 'slug' ? categories.slug
    : categories.dateCreated;
  
  const orderFn = order === 'asc' ? asc : desc;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(categories)
    .where(and(...conditions));
  
  const total = Number(count);
  
  let query = db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(per_page)
    .offset(offset);
  
  const items = await query;
  
  // Filter empty if hide_empty
  let filteredItems = items;
  if (hide_empty) {
    filteredItems = items.filter(item => item.count > 0);
  }
  
  return createPaginationResult(filteredItems, total, page, per_page);
};

export const getCategory = async (id: number): Promise<Category | null> => {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.isDeleted, false)))
    .limit(1);
  
  return category ?? null;
};

export const createCategory = async (input: CreateCategoryInput): Promise<Category> => {
  const slug = input.slug ?? await generateUniqueSlug(input.name);
  
  const newCategory: NewCategory = {
    name: input.name,
    slug,
    parentId: input.parent ?? 0,
    description: input.description ?? null,
    display: input.display ?? 'default',
    image: input.image ?? null,
    menuOrder: input.menu_order ?? 0,
    count: 0,
    dateCreated: new Date(),
    dateModified: new Date(),
    isDeleted: false,
  };
  
  const [category] = await db.insert(categories).values(newCategory).returning();
  
  return category;
};

export const updateCategory = async (
  id: number,
  input: UpdateCategoryInput
): Promise<Category | null> => {
  const existing = await getCategory(id);
  if (!existing) return null;
  
  const updateData: Partial<NewCategory> = {
    dateModified: new Date(),
  };
  
  if (input.name !== undefined) {
    updateData.name = input.name;
    if (!input.slug) {
      updateData.slug = await generateUniqueSlug(input.name, id);
    }
  }
  
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.parent !== undefined) updateData.parentId = input.parent;
  if (input.description !== undefined) updateData.description = input.description ?? null;
  if (input.display !== undefined) updateData.display = input.display;
  if (input.image !== undefined) updateData.image = input.image ?? null;
  if (input.menu_order !== undefined) updateData.menuOrder = input.menu_order;
  
  const [category] = await db
    .update(categories)
    .set(updateData)
    .where(and(eq(categories.id, id), eq(categories.isDeleted, false)))
    .returning();
  
  return category ?? null;
};

export const deleteCategory = async (id: number, force = false): Promise<Category | null> => {
  const existing = await getCategory(id);
  if (!existing) return null;
  
  if (force) {
    await db.delete(categories).where(eq(categories.id, id));
    return existing;
  }
  
  const [category] = await db
    .update(categories)
    .set({ 
      isDeleted: true, 
      dateModified: new Date(),
    })
    .where(eq(categories.id, id))
    .returning();
  
  return category ?? null;
};

export const categoryService = {
  list: listCategories,
  get: getCategory,
  create: createCategory,
  update: updateCategory,
  delete: deleteCategory,
};

export default categoryService;
