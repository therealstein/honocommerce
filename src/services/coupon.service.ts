/**
 * Coupon Service
 */

import { db } from '../db';
import { coupons, type Coupon, type NewCoupon } from '../db/schema/coupons';
import { eq, and, desc, asc, sql, like, inArray } from 'drizzle-orm';
import type { PaginationResult } from '../lib/pagination';
import { createPaginationResult } from '../lib/pagination';
import type { CreateCouponInput, UpdateCouponInput, CouponListQuery } from '../validators/coupon.validators';

export const listCoupons = async (params: CouponListQuery): Promise<PaginationResult<Coupon>> => {
  const { page, per_page, order, orderby, search, include, exclude, code } = params;
  
  const offset = (page - 1) * per_page;
  const conditions = [eq(coupons.isDeleted, false)];
  
  if (code) conditions.push(eq(coupons.code, code));
  if (search) conditions.push(like(coupons.code, `%${search}%`));
  if (include && include.length > 0) conditions.push(inArray(coupons.id, include));
  if (exclude && exclude.length > 0) conditions.push(sql`${coupons.id} NOT IN ${exclude}`);
  
  const orderColumn = orderby === 'id' ? coupons.id 
    : orderby === 'title' ? coupons.code
    : coupons.dateCreated;
  
  const orderFn = order === 'asc' ? asc : desc;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(coupons)
    .where(and(...conditions));
  
  const total = Number(count);
  
  const items = await db
    .select()
    .from(coupons)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(per_page)
    .offset(offset);
  
  return createPaginationResult(items, total, page, per_page);
};

export const getCoupon = async (id: number): Promise<Coupon | null> => {
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.id, id), eq(coupons.isDeleted, false)))
    .limit(1);
  
  return coupon ?? null;
};

export const getCouponByCode = async (code: string): Promise<Coupon | null> => {
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.code, code.toUpperCase()), eq(coupons.isDeleted, false)))
    .limit(1);
  
  return coupon ?? null;
};

export const createCoupon = async (input: CreateCouponInput): Promise<Coupon> => {
  const now = new Date();
  const newCoupon: NewCoupon = {
    code: input.code.toUpperCase(),
    amount: input.amount,
    discountType: input.discount_type ?? 'fixed_cart',
    description: input.description ?? null,
    dateExpires: input.date_expires ? new Date(input.date_expires) : null,
    dateExpiresGmt: input.date_expires_gmt ? new Date(input.date_expires_gmt) : null,
    usageCount: 0,
    individualUse: input.individual_use ?? false,
    productIds: input.product_ids ?? [],
    excludedProductIds: input.excluded_product_ids ?? [],
    usageLimit: input.usage_limit ?? null,
    usageLimitPerUser: input.usage_limit_per_user ?? null,
    limitUsageToXItems: input.limit_usage_to_x_items ?? null,
    freeShipping: input.free_shipping ?? false,
    productCategories: input.product_categories ?? [],
    excludedProductCategories: input.excluded_product_categories ?? [],
    excludeSaleItems: input.exclude_sale_items ?? false,
    minimumAmount: input.minimum_amount ?? null,
    maximumAmount: input.maximum_amount ?? null,
    emailRestrictions: input.email_restrictions ?? [],
    usedBy: [],
    metaData: input.meta_data ?? [],
    dateCreated: now,
    dateCreatedGmt: now,
    dateModified: now,
    dateModifiedGmt: now,
    isDeleted: false,
  };
  
  const [coupon] = await db.insert(coupons).values(newCoupon).returning();
  return coupon;
};

export const updateCoupon = async (id: number, input: UpdateCouponInput): Promise<Coupon | null> => {
  const existing = await getCoupon(id);
  if (!existing) return null;
  
  const updateData: Partial<NewCoupon> = {
    dateModified: new Date(),
    dateModifiedGmt: new Date(),
  };
  
  if (input.code !== undefined) updateData.code = input.code.toUpperCase();
  if (input.amount !== undefined) updateData.amount = input.amount;
  if (input.discount_type !== undefined) updateData.discountType = input.discount_type;
  if (input.description !== undefined) updateData.description = input.description ?? null;
  if (input.date_expires !== undefined) updateData.dateExpires = input.date_expires ? new Date(input.date_expires) : null;
  if (input.date_expires_gmt !== undefined) updateData.dateExpiresGmt = input.date_expires_gmt ? new Date(input.date_expires_gmt) : null;
  if (input.individual_use !== undefined) updateData.individualUse = input.individual_use;
  if (input.product_ids !== undefined) updateData.productIds = input.product_ids;
  if (input.excluded_product_ids !== undefined) updateData.excludedProductIds = input.excluded_product_ids;
  if (input.usage_limit !== undefined) updateData.usageLimit = input.usage_limit;
  if (input.usage_limit_per_user !== undefined) updateData.usageLimitPerUser = input.usage_limit_per_user;
  if (input.limit_usage_to_x_items !== undefined) updateData.limitUsageToXItems = input.limit_usage_to_x_items;
  if (input.free_shipping !== undefined) updateData.freeShipping = input.free_shipping;
  if (input.product_categories !== undefined) updateData.productCategories = input.product_categories;
  if (input.excluded_product_categories !== undefined) updateData.excludedProductCategories = input.excluded_product_categories;
  if (input.exclude_sale_items !== undefined) updateData.excludeSaleItems = input.exclude_sale_items;
  if (input.minimum_amount !== undefined) updateData.minimumAmount = input.minimum_amount;
  if (input.maximum_amount !== undefined) updateData.maximumAmount = input.maximum_amount;
  if (input.email_restrictions !== undefined) updateData.emailRestrictions = input.email_restrictions;
  if (input.meta_data !== undefined) updateData.metaData = input.meta_data ?? [];
  
  const [coupon] = await db
    .update(coupons)
    .set(updateData)
    .where(and(eq(coupons.id, id), eq(coupons.isDeleted, false)))
    .returning();
  
  return coupon ?? null;
};

export const deleteCoupon = async (id: number, force = false): Promise<Coupon | null> => {
  const existing = await getCoupon(id);
  if (!existing) return null;
  
  if (force) {
    await db.delete(coupons).where(eq(coupons.id, id));
    return existing;
  }
  
  const [coupon] = await db
    .update(coupons)
    .set({ isDeleted: true, dateModified: new Date(), dateModifiedGmt: new Date() })
    .where(eq(coupons.id, id))
    .returning();
  
  return coupon ?? null;
};

export const couponService = {
  list: listCoupons,
  get: getCoupon,
  getByCode: getCouponByCode,
  create: createCoupon,
  update: updateCoupon,
  delete: deleteCoupon,
};

export default couponService;
