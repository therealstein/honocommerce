/**
 * Coupon Response Formatter
 */

import type { Coupon } from '../db/schema/coupons';
import { buildLinks, formatDate, formatDateGmt } from './wc-response';

export interface CouponResponse {
  id: number;
  code: string;
  amount: string;
  date_created: string | null;
  date_created_gmt: string | null;
  date_modified: string | null;
  date_modified_gmt: string | null;
  discount_type: string;
  description: string | null;
  date_expires: string | null;
  date_expires_gmt: string | null;
  usage_count: number;
  individual_use: boolean;
  product_ids: number[];
  excluded_product_ids: number[];
  usage_limit: number | null;
  usage_limit_per_user: number | null;
  limit_usage_to_x_items: number | null;
  free_shipping: boolean;
  product_categories: number[];
  excluded_product_categories: number[];
  exclude_sale_items: boolean;
  minimum_amount: string | null;
  maximum_amount: string | null;
  email_restrictions: string[];
  used_by: number[];
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatCouponResponse = (coupon: Coupon): CouponResponse => ({
  id: coupon.id,
  code: coupon.code,
  amount: coupon.amount,
  date_created: formatDate(coupon.dateCreated),
  date_created_gmt: formatDateGmt(coupon.dateCreatedGmt),
  date_modified: formatDate(coupon.dateModified),
  date_modified_gmt: formatDateGmt(coupon.dateModifiedGmt),
  discount_type: coupon.discountType,
  description: coupon.description,
  date_expires: formatDate(coupon.dateExpires),
  date_expires_gmt: formatDateGmt(coupon.dateExpiresGmt),
  usage_count: coupon.usageCount,
  individual_use: coupon.individualUse,
  product_ids: coupon.productIds as number[],
  excluded_product_ids: coupon.excludedProductIds as number[],
  usage_limit: coupon.usageLimit,
  usage_limit_per_user: coupon.usageLimitPerUser,
  limit_usage_to_x_items: coupon.limitUsageToXItems,
  free_shipping: coupon.freeShipping,
  product_categories: coupon.productCategories as number[],
  excluded_product_categories: coupon.excludedProductCategories as number[],
  exclude_sale_items: coupon.excludeSaleItems,
  minimum_amount: coupon.minimumAmount,
  maximum_amount: coupon.maximumAmount,
  email_restrictions: coupon.emailRestrictions as string[],
  used_by: coupon.usedBy as number[],
  meta_data: (coupon.metaData as Array<{ key: string; value: unknown }>)?.map((m, i) => ({ ...m, id: i })) ?? [],
  _links: buildLinks(
    `/wp-json/wc/v3/coupons/${coupon.id}`,
    '/wp-json/wc/v3/coupons'
  ),
});

export const formatCouponListResponse = (coupons: Coupon[]): CouponResponse[] =>
  coupons.map(formatCouponResponse);
