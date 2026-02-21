/**
 * Product Tag Service
 */

import { db } from '../db';
import { tags, type Tag, type NewTag } from '../db/schema/product-tags';
import { eq, and, desc, asc, sql, like, inArray } from 'drizzle-orm';
import type { PaginationResult } from '../lib/pagination';
import { createPaginationResult } from '../lib/pagination';
import type { CreateTagInput, UpdateTagInput, TagListQuery } from '../validators/tag.validators';

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
    const conditions = [eq(tags.slug, slug)];
    if (excludeId) {
      conditions.push(sql`${tags.id} != ${excludeId}`);
    }
    
    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(...conditions))
      .limit(1);
    
    if (!existing) break;
    
    counter++;
    slug = `${generateSlug(name)}-${counter}`;
  }
  
  return slug;
};

export const listTags = async (
  params: TagListQuery
): Promise<PaginationResult<Tag>> => {
  const { page, per_page, order, orderby, search, include, exclude, hide_empty } = params;
  
  const offset = (page - 1) * per_page;
  const conditions = [eq(tags.isDeleted, false)];
  
  if (search) {
    conditions.push(like(tags.name, `%${search}%`));
  }
  
  if (include && include.length > 0) {
    conditions.push(inArray(tags.id, include));
  }
  
  if (exclude && exclude.length > 0) {
    conditions.push(sql`${tags.id} NOT IN ${exclude}`);
  }
  
  const orderColumn = orderby === 'id' ? tags.id 
    : orderby === 'title' ? tags.name
    : orderby === 'slug' ? tags.slug
    : tags.dateCreated;
  
  const orderFn = order === 'asc' ? asc : desc;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tags)
    .where(and(...conditions));
  
  const total = Number(count);
  
  const items = await db
    .select()
    .from(tags)
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

export const getTag = async (id: number): Promise<Tag | null> => {
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.isDeleted, false)))
    .limit(1);
  
  return tag ?? null;
};

export const createTag = async (input: CreateTagInput): Promise<Tag> => {
  const slug = input.slug ?? await generateUniqueSlug(input.name);
  
  const newTag: NewTag = {
    name: input.name,
    slug,
    description: input.description ?? null,
    count: 0,
    dateCreated: new Date(),
    dateModified: new Date(),
    isDeleted: false,
  };
  
  const [tag] = await db.insert(tags).values(newTag).returning();
  
  return tag;
};

export const updateTag = async (
  id: number,
  input: UpdateTagInput
): Promise<Tag | null> => {
  const existing = await getTag(id);
  if (!existing) return null;
  
  const updateData: Partial<NewTag> = {
    dateModified: new Date(),
  };
  
  if (input.name !== undefined) {
    updateData.name = input.name;
    if (!input.slug) {
      updateData.slug = await generateUniqueSlug(input.name, id);
    }
  }
  
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.description !== undefined) updateData.description = input.description ?? null;
  
  const [tag] = await db
    .update(tags)
    .set(updateData)
    .where(and(eq(tags.id, id), eq(tags.isDeleted, false)))
    .returning();
  
  return tag ?? null;
};

export const deleteTag = async (id: number, force = false): Promise<Tag | null> => {
  const existing = await getTag(id);
  if (!existing) return null;
  
  if (force) {
    await db.delete(tags).where(eq(tags.id, id));
    return existing;
  }
  
  const [tag] = await db
    .update(tags)
    .set({ 
      isDeleted: true, 
      dateModified: new Date(),
    })
    .where(eq(tags.id, id))
    .returning();
  
  return tag ?? null;
};

export const tagService = {
  list: listTags,
  get: getTag,
  create: createTag,
  update: updateTag,
  delete: deleteTag,
};

export default tagService;
