/**
 * Product Variation Service
 */

import { db } from '../db';
import { 
  productVariations, variationAttributes,
  type ProductVariation, type NewProductVariation
} from '../db/schema/product-variations';
import { products } from '../db/schema/products';
import { eq, and, desc, asc, sql, like, inArray } from 'drizzle-orm';
import type { PaginationResult } from '../lib/pagination';
import { createPaginationResult } from '../lib/pagination';
import type { CreateVariationInput, UpdateVariationInput, VariationListQuery } from '../validators/variation.validators';

export const listVariations = async (
  productId: number,
  params: VariationListQuery
): Promise<PaginationResult<ProductVariation>> => {
  const { page, per_page, order, orderby, search, include, exclude } = params;
  
  const offset = (page - 1) * per_page;
  const conditions = [eq(productVariations.parentId, productId)];
  
  if (search) {
    conditions.push(like(productVariations.sku, `%${search}%`));
  }
  
  if (include && include.length > 0) {
    conditions.push(inArray(productVariations.id, include));
  }
  
  if (exclude && exclude.length > 0) {
    conditions.push(sql`${productVariations.id} NOT IN ${exclude}`);
  }
  
  const orderColumn = orderby === 'id' ? productVariations.id 
    : orderby === 'title' ? productVariations.description
    : productVariations.dateCreated;
  
  const orderFn = order === 'asc' ? asc : desc;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(productVariations)
    .where(and(...conditions));
  
  const total = Number(count);
  
  const items = await db
    .select()
    .from(productVariations)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(per_page)
    .offset(offset);
  
  return createPaginationResult(items, total, page, per_page);
};

export const getVariation = async (productId: number, variationId: number): Promise<ProductVariation | null> => {
  const [variation] = await db
    .select()
    .from(productVariations)
    .where(and(
      eq(productVariations.id, variationId),
      eq(productVariations.parentId, productId)
    ))
    .limit(1);
  
  return variation ?? null;
};

export const getVariationBySku = async (sku: string): Promise<ProductVariation | null> => {
  const [variation] = await db
    .select()
    .from(productVariations)
    .where(eq(productVariations.sku, sku))
    .limit(1);
  
  return variation ?? null;
};

export const createVariation = async (
  productId: number,
  input: CreateVariationInput
): Promise<ProductVariation> => {
  const now = new Date();
  
  const newVariation: NewProductVariation = {
    parentId: productId,
    description: input.description ?? null,
    sku: input.sku ?? null,
    price: input.regular_price ?? null,
    regularPrice: input.regular_price ?? null,
    salePrice: input.sale_price ?? null,
    dateOnSaleFrom: input.date_on_sale_from ? new Date(input.date_on_sale_from) : null,
    dateOnSaleFromGmt: input.date_on_sale_from_gmt ? new Date(input.date_on_sale_from_gmt) : null,
    dateOnSaleTo: input.date_on_sale_to ? new Date(input.date_on_sale_to) : null,
    dateOnSaleToGmt: input.date_on_sale_to_gmt ? new Date(input.date_on_sale_to_gmt) : null,
    status: input.status ?? 'publish',
    virtual: input.virtual ?? false,
    downloadable: input.downloadable ?? false,
    downloads: input.downloads ?? [],
    downloadLimit: input.download_limit ?? -1,
    downloadExpiry: input.download_expiry ?? -1,
    taxStatus: input.tax_status ?? 'taxable',
    taxClass: input.tax_class ?? null,
    manageStock: input.manage_stock ?? false,
    stockQuantity: input.stock_quantity ?? null,
    stockStatus: input.stock_status ?? 'instock',
    backorders: input.backorders ?? 'no',
    weight: input.weight ?? null,
    length: input.dimensions?.length ?? null,
    width: input.dimensions?.width ?? null,
    height: input.dimensions?.height ?? null,
    shippingClassId: 0,
    imageId: input.image?.id ?? null,
    menuOrder: input.menu_order ?? 0,
    dateCreated: now,
    dateCreatedGmt: now,
    dateModified: now,
    dateModifiedGmt: now,
  };
  
  const [variation] = await db.insert(productVariations).values(newVariation).returning();
  
  // Store variation attributes
  if (input.attributes && input.attributes.length > 0) {
    for (const attr of input.attributes) {
      await db.insert(variationAttributes).values({
        variationId: variation.id,
        attributeId: attr.id ?? 0,
        name: attr.name,
        option: attr.option,
      });
    }
  }
  
  return variation;
};

export const updateVariation = async (
  productId: number,
  variationId: number,
  input: UpdateVariationInput
): Promise<ProductVariation | null> => {
  const existing = await getVariation(productId, variationId);
  if (!existing) return null;
  
  const updateData: Partial<NewProductVariation> = {
    dateModified: new Date(),
    dateModifiedGmt: new Date(),
  };
  
  if (input.description !== undefined) updateData.description = input.description ?? null;
  if (input.sku !== undefined) updateData.sku = input.sku ?? null;
  if (input.regular_price !== undefined) {
    updateData.regularPrice = input.regular_price ?? null;
    updateData.price = input.regular_price ?? null;
  }
  if (input.sale_price !== undefined) updateData.salePrice = input.sale_price ?? null;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.virtual !== undefined) updateData.virtual = input.virtual;
  if (input.downloadable !== undefined) updateData.downloadable = input.downloadable;
  if (input.manage_stock !== undefined) updateData.manageStock = input.manage_stock;
  if (input.stock_quantity !== undefined) updateData.stockQuantity = input.stock_quantity;
  if (input.stock_status !== undefined) updateData.stockStatus = input.stock_status;
  if (input.weight !== undefined) updateData.weight = input.weight ?? null;
  if (input.dimensions?.length !== undefined) updateData.length = input.dimensions.length ?? null;
  if (input.dimensions?.width !== undefined) updateData.width = input.dimensions.width ?? null;
  if (input.dimensions?.height !== undefined) updateData.height = input.dimensions.height ?? null;
  if (input.menu_order !== undefined) updateData.menuOrder = input.menu_order;
  
  const [variation] = await db
    .update(productVariations)
    .set(updateData)
    .where(and(
      eq(productVariations.id, variationId),
      eq(productVariations.parentId, productId)
    ))
    .returning();
  
  // Update attributes if provided
  if (input.attributes !== undefined) {
    await db.delete(variationAttributes).where(eq(variationAttributes.variationId, variationId));
    
    for (const attr of input.attributes) {
      await db.insert(variationAttributes).values({
        variationId: variationId,
        attributeId: attr.id ?? 0,
        name: attr.name,
        option: attr.option,
      });
    }
  }
  
  return variation ?? null;
};

export const deleteVariation = async (
  productId: number,
  variationId: number,
  force = false
): Promise<ProductVariation | null> => {
  const existing = await getVariation(productId, variationId);
  if (!existing) return null;
  
  if (force) {
    await db.delete(variationAttributes).where(eq(variationAttributes.variationId, variationId));
    await db.delete(productVariations).where(eq(productVariations.id, variationId));
    return existing;
  }
  
  const [variation] = await db
    .update(productVariations)
    .set({ status: 'trash', dateModified: new Date(), dateModifiedGmt: new Date() })
    .where(eq(productVariations.id, variationId))
    .returning();
  
  return variation ?? null;
};

export const getVariationAttributes = async (variationId: number): Promise<Array<{ name: string; option: string }>> => {
  const attrs = await db
    .select()
    .from(variationAttributes)
    .where(eq(variationAttributes.variationId, variationId));
  
  return attrs.map(a => ({ name: a.name, option: a.option }));
};

export const variationService = {
  list: listVariations,
  get: getVariation,
  getBySku: getVariationBySku,
  create: createVariation,
  update: updateVariation,
  delete: deleteVariation,
  getAttributes: getVariationAttributes,
};

export default variationService;
