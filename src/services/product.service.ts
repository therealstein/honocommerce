/**
 * Product Service
 * Business logic for product operations
 */

import { db } from '../db';
import { products, productCategories, productTags, productImages, type Product, type NewProduct, type ProductImage } from '../db/schema/products';
import { categories } from '../db/schema/product-categories';
import { tags } from '../db/schema/product-tags';
import { productVariations } from '../db/schema/product-variations';
import { eq, and, desc, asc, sql, like, inArray } from 'drizzle-orm';
import type { PaginationResult } from '../lib/pagination';
import { createPaginationResult } from '../lib/pagination';
import type { CreateProductInput, UpdateProductInput, ProductListQuery } from '../validators/product.validators';

// Types for related data
export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
}

export interface ProductTag {
  id: number;
  name: string;
  slug: string;
}

export interface ProductImageResponse {
  id: number;
  productId: number;
  src: string;
  name: string;
  alt: string;
  position: number;
  dateCreated: Date | null;
}

/**
 * Generate a URL-friendly slug from a name
 */
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Generate a unique slug by appending a number if necessary
 */
const generateUniqueSlug = async (name: string, excludeId?: number): Promise<string> => {
  let slug = generateSlug(name);
  let counter = 0;
  
  while (true) {
    const conditions = [eq(products.slug, slug)];
    if (excludeId) {
      conditions.push(sql`${products.id} != ${excludeId}`);
    }
    
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(...conditions))
      .limit(1);
    
    if (!existing) break;
    
    counter++;
    slug = `${generateSlug(name)}-${counter}`;
  }
  
  return slug;
};

/**
 * List products with pagination and filtering
 */
export const listProducts = async (
  params: ProductListQuery
): Promise<PaginationResult<Product>> => {
  const { 
    page, 
    per_page, 
    order, 
    orderby, 
    search, 
    include, 
    exclude,
    type,
    status,
    featured,
    sku,
    stock_status,
    slug,
  } = params;
  
  const offset = (page - 1) * per_page;
  
  // Build where conditions
  const conditions = [eq(products.isDeleted, false)];
  
  if (search) {
    conditions.push(like(products.name, `%${search}%`));
  }
  
  if (include && include.length > 0) {
    conditions.push(inArray(products.id, include));
  }
  
  if (exclude && exclude.length > 0) {
    conditions.push(sql`${products.id} NOT IN ${exclude}`);
  }
  
  if (type) {
    conditions.push(eq(products.type, type));
  }
  
  if (status) {
    conditions.push(eq(products.status, status));
  }
  
  if (featured !== undefined) {
    conditions.push(eq(products.featured, featured));
  }
  
  if (sku) {
    conditions.push(eq(products.sku, sku));
  }
  
  if (stock_status) {
    conditions.push(eq(products.stockStatus, stock_status));
  }
  
  if (slug) {
    conditions.push(eq(products.slug, slug));
  }
  
  // Determine order column
  const orderColumn = orderby === 'id' ? products.id 
    : orderby === 'title' ? products.name
    : orderby === 'slug' ? products.slug
    : orderby === 'include' ? products.id // TODO: Respect include order
    : products.dateCreated;
  
  const orderFn = order === 'asc' ? asc : desc;
  
  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(and(...conditions));
  
  const total = Number(count);
  
  // Get paginated results
  const items = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(per_page)
    .offset(offset);
  
  return createPaginationResult(items, total, page, per_page);
};

/**
 * Get a single product by ID
 */
export const getProduct = async (id: number): Promise<Product | null> => {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.isDeleted, false)))
    .limit(1);
  
  return product ?? null;
};

/**
 * Get a product by SKU
 */
export const getProductBySku = async (sku: string): Promise<Product | null> => {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.sku, sku), eq(products.isDeleted, false)))
    .limit(1);
  
  return product ?? null;
};

/**
 * Create a new product
 */
export const createProduct = async (input: CreateProductInput): Promise<Product> => {
  const slug = input.slug ?? await generateUniqueSlug(input.name);
  const now = new Date();
  
  const newProduct: NewProduct = {
    name: input.name,
    slug,
    type: input.type ?? 'simple',
    status: input.status ?? 'draft',
    featured: input.featured ?? false,
    catalogVisibility: input.catalog_visibility ?? 'visible',
    description: input.description ?? null,
    shortDescription: input.short_description ?? null,
    sku: input.sku ?? null,
    price: input.regular_price ?? null,
    regularPrice: input.regular_price ?? null,
    salePrice: input.sale_price ?? null,
    dateOnSaleFrom: input.date_on_sale_from ? new Date(input.date_on_sale_from) : null,
    dateOnSaleFromGmt: input.date_on_sale_from_gmt ? new Date(input.date_on_sale_from_gmt) : null,
    dateOnSaleTo: input.date_on_sale_to ? new Date(input.date_on_sale_to) : null,
    dateOnSaleToGmt: input.date_on_sale_to_gmt ? new Date(input.date_on_sale_to_gmt) : null,
    virtual: input.virtual ?? false,
    downloadable: input.downloadable ?? false,
    downloads: input.downloads ?? [],
    downloadLimit: input.download_limit ?? -1,
    downloadExpiry: input.download_expiry ?? -1,
    externalUrl: input.external_url ?? null,
    buttonText: input.button_text ?? null,
    taxStatus: input.tax_status ?? 'taxable',
    taxClass: input.tax_class ?? null,
    manageStock: input.manage_stock ?? false,
    stockQuantity: input.stock_quantity ?? null,
    stockStatus: input.stock_status ?? 'instock',
    backorders: input.backorders ?? 'no',
    soldIndividually: input.sold_individually ?? false,
    weight: input.weight ?? null,
    length: input.dimensions?.length ?? null,
    width: input.dimensions?.width ?? null,
    height: input.dimensions?.height ?? null,
    shippingClassId: 0, // TODO: Look up shipping class ID from shipping_class string
    reviewsAllowed: input.reviews_allowed ?? true,
    parentId: input.parent_id ?? 0,
    purchaseNote: input.purchase_note ?? null,
    menuOrder: input.menu_order ?? 0,
    totalSales: 0,
    dateCreated: now,
    dateCreatedGmt: now,
    dateModified: now,
    dateModifiedGmt: now,
    isDeleted: false,
  };
  
  const [product] = await db.insert(products).values(newProduct).returning();
  
  return product;
};

/**
 * Update a product
 */
export const updateProduct = async (
  id: number,
  input: UpdateProductInput
): Promise<Product | null> => {
  const existingProduct = await getProduct(id);
  if (!existingProduct) return null;
  
  const updateData: Partial<NewProduct> = {
    dateModified: new Date(),
    dateModifiedGmt: new Date(),
  };
  
  if (input.name !== undefined) {
    updateData.name = input.name;
    if (!input.slug) {
      updateData.slug = await generateUniqueSlug(input.name, id);
    }
  }
  
  if (input.slug !== undefined) {
    updateData.slug = input.slug;
  }
  
  if (input.type !== undefined) updateData.type = input.type;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.featured !== undefined) updateData.featured = input.featured;
  if (input.catalog_visibility !== undefined) updateData.catalogVisibility = input.catalog_visibility;
  if (input.description !== undefined) updateData.description = input.description ?? null;
  if (input.short_description !== undefined) updateData.shortDescription = input.short_description ?? null;
  if (input.sku !== undefined) updateData.sku = input.sku ?? null;
  if (input.regular_price !== undefined) {
    updateData.regularPrice = input.regular_price ?? null;
    updateData.price = input.regular_price ?? null;
  }
  if (input.sale_price !== undefined) updateData.salePrice = input.sale_price ?? null;
  if (input.date_on_sale_from !== undefined) updateData.dateOnSaleFrom = input.date_on_sale_from ? new Date(input.date_on_sale_from) : null;
  if (input.date_on_sale_from_gmt !== undefined) updateData.dateOnSaleFromGmt = input.date_on_sale_from_gmt ? new Date(input.date_on_sale_from_gmt) : null;
  if (input.date_on_sale_to !== undefined) updateData.dateOnSaleTo = input.date_on_sale_to ? new Date(input.date_on_sale_to) : null;
  if (input.date_on_sale_to_gmt !== undefined) updateData.dateOnSaleToGmt = input.date_on_sale_to_gmt ? new Date(input.date_on_sale_to_gmt) : null;
  if (input.virtual !== undefined) updateData.virtual = input.virtual;
  if (input.downloadable !== undefined) updateData.downloadable = input.downloadable;
  if (input.downloads !== undefined) updateData.downloads = input.downloads;
  if (input.download_limit !== undefined) updateData.downloadLimit = input.download_limit;
  if (input.download_expiry !== undefined) updateData.downloadExpiry = input.download_expiry;
  if (input.external_url !== undefined) updateData.externalUrl = input.external_url ?? null;
  if (input.button_text !== undefined) updateData.buttonText = input.button_text ?? null;
  if (input.tax_status !== undefined) updateData.taxStatus = input.tax_status;
  if (input.tax_class !== undefined) updateData.taxClass = input.tax_class ?? null;
  if (input.manage_stock !== undefined) updateData.manageStock = input.manage_stock;
  if (input.stock_quantity !== undefined) updateData.stockQuantity = input.stock_quantity;
  if (input.stock_status !== undefined) updateData.stockStatus = input.stock_status;
  if (input.backorders !== undefined) updateData.backorders = input.backorders;
  if (input.sold_individually !== undefined) updateData.soldIndividually = input.sold_individually;
  if (input.weight !== undefined) updateData.weight = input.weight ?? null;
  if (input.dimensions?.length !== undefined) updateData.length = input.dimensions.length ?? null;
  if (input.dimensions?.width !== undefined) updateData.width = input.dimensions.width ?? null;
  if (input.dimensions?.height !== undefined) updateData.height = input.dimensions.height ?? null;
  if (input.reviews_allowed !== undefined) updateData.reviewsAllowed = input.reviews_allowed;
  if (input.parent_id !== undefined) updateData.parentId = input.parent_id;
  if (input.purchase_note !== undefined) updateData.purchaseNote = input.purchase_note ?? null;
  if (input.menu_order !== undefined) updateData.menuOrder = input.menu_order;
  
  const [product] = await db
    .update(products)
    .set(updateData)
    .where(and(eq(products.id, id), eq(products.isDeleted, false)))
    .returning();
  
  return product ?? null;
};

/**
 * Delete a product (soft delete by default, hard delete with force)
 */
export const deleteProduct = async (id: number, force = false): Promise<Product | null> => {
  // First check if product exists
  const existing = await getProduct(id);
  if (!existing) return null;
  
  if (force) {
    await db.delete(products).where(eq(products.id, id));
    return existing;
  }
  
  // Soft delete - mark as trash
  const [product] = await db
    .update(products)
    .set({ 
      isDeleted: true, 
      status: 'trash',
      dateModified: new Date(),
      dateModifiedGmt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();
  
  return product ?? null;
};

/**
 * Batch create products
 */
export const batchCreateProducts = async (
  inputs: CreateProductInput[]
): Promise<Product[]> => {
  const results: Product[] = [];
  
  for (const input of inputs) {
    const product = await createProduct(input);
    results.push(product);
  }
  
  return results;
};

/**
 * Batch update products
 */
export const batchUpdateProducts = async (
  updates: Array<{ id: number } & UpdateProductInput>
): Promise<(Product | null)[]> => {
  const results: (Product | null)[] = [];
  
  for (const update of updates) {
    const { id, ...input } = update;
    const product = await updateProduct(id, input);
    results.push(product);
  }
  
  return results;
};

/**
 * Batch delete products
 */
export const batchDeleteProducts = async (
  ids: number[],
  force = false
): Promise<(Product | null)[]> => {
  const results: (Product | null)[] = [];
  
  for (const id of ids) {
    const product = await deleteProduct(id, force);
    results.push(product);
  }
  
  return results;
};

// ==================== RELATED DATA METHODS ====================

/**
 * Get categories for a single product
 */
export const getProductCategories = async (productId: number): Promise<ProductCategory[]> => {
  const result = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(productCategories)
    .innerJoin(categories, eq(productCategories.categoryId, categories.id))
    .where(eq(productCategories.productId, productId));
  
  return result;
};

/**
 * Get tags for a single product
 */
export const getProductTags = async (productId: number): Promise<ProductTag[]> => {
  const result = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(productTags)
    .innerJoin(tags, eq(productTags.tagId, tags.id))
    .where(eq(productTags.productId, productId));
  
  return result;
};

/**
 * Get images for a single product
 */
export const getProductImages = async (productId: number): Promise<ProductImageResponse[]> => {
  const result = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.position));
  
  return result.map(img => ({
    id: img.id,
    productId: img.productId,
    src: img.src,
    name: img.name ?? '',
    alt: img.alt ?? '',
    position: img.position,
    dateCreated: img.dateCreated,
  }));
};

/**
 * Get variation IDs for a single product
 */
export const getProductVariationIds = async (productId: number): Promise<number[]> => {
  const result = await db
    .select({ id: productVariations.id })
    .from(productVariations)
    .where(eq(productVariations.parentId, productId));
  
  return result.map(v => v.id);
};

// ==================== BATCH RELATED DATA METHODS ====================

/**
 * Batch get categories for multiple products
 * Returns a Map of productId -> categories[]
 */
export const batchGetProductCategories = async (productIds: number[]): Promise<Map<number, ProductCategory[]>> => {
  if (productIds.length === 0) return new Map();
  
  const result = await db
    .select({
      productId: productCategories.productId,
      categoryId: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(productCategories)
    .innerJoin(categories, eq(productCategories.categoryId, categories.id))
    .where(inArray(productCategories.productId, productIds));
  
  const map = new Map<number, ProductCategory[]>();
  for (const row of result) {
    const existing = map.get(row.productId) ?? [];
    existing.push({ id: row.categoryId, name: row.name, slug: row.slug });
    map.set(row.productId, existing);
  }
  
  // Ensure all product IDs have entries
  for (const id of productIds) {
    if (!map.has(id)) map.set(id, []);
  }
  
  return map;
};

/**
 * Batch get tags for multiple products
 * Returns a Map of productId -> tags[]
 */
export const batchGetProductTags = async (productIds: number[]): Promise<Map<number, ProductTag[]>> => {
  if (productIds.length === 0) return new Map();
  
  const result = await db
    .select({
      productId: productTags.productId,
      tagId: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(productTags)
    .innerJoin(tags, eq(productTags.tagId, tags.id))
    .where(inArray(productTags.productId, productIds));
  
  const map = new Map<number, ProductTag[]>();
  for (const row of result) {
    const existing = map.get(row.productId) ?? [];
    existing.push({ id: row.tagId, name: row.name, slug: row.slug });
    map.set(row.productId, existing);
  }
  
  // Ensure all product IDs have entries
  for (const id of productIds) {
    if (!map.has(id)) map.set(id, []);
  }
  
  return map;
};

/**
 * Batch get images for multiple products
 * Returns a Map of productId -> images[]
 */
export const batchGetProductImages = async (productIds: number[]): Promise<Map<number, ProductImageResponse[]>> => {
  if (productIds.length === 0) return new Map();
  
  const result = await db
    .select()
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(asc(productImages.position));
  
  const map = new Map<number, ProductImageResponse[]>();
  for (const img of result) {
    const existing = map.get(img.productId) ?? [];
    existing.push({
      id: img.id,
      productId: img.productId,
      src: img.src,
      name: img.name ?? '',
      alt: img.alt ?? '',
      position: img.position,
      dateCreated: img.dateCreated,
    });
    map.set(img.productId, existing);
  }
  
  // Ensure all product IDs have entries
  for (const id of productIds) {
    if (!map.has(id)) map.set(id, []);
  }
  
  return map;
};

/**
 * Batch get variation IDs for multiple products
 * Returns a Map of productId -> variationIds[]
 */
export const batchGetProductVariationIds = async (productIds: number[]): Promise<Map<number, number[]>> => {
  if (productIds.length === 0) return new Map();
  
  const result = await db
    .select({ id: productVariations.id, parentId: productVariations.parentId })
    .from(productVariations)
    .where(inArray(productVariations.parentId, productIds));
  
  const map = new Map<number, number[]>();
  for (const row of result) {
    const existing = map.get(row.parentId) ?? [];
    existing.push(row.id);
    map.set(row.parentId, existing);
  }
  
  // Ensure all product IDs have entries
  for (const id of productIds) {
    if (!map.has(id)) map.set(id, []);
  }
  
  return map;
};

// ==================== SERVICE EXPORT ====================

export const productService = {
  list: listProducts,
  get: getProduct,
  getBySku: getProductBySku,
  create: createProduct,
  update: updateProduct,
  delete: deleteProduct,
  batchCreate: batchCreateProducts,
  batchUpdate: batchUpdateProducts,
  batchDelete: batchDeleteProducts,
  // Related data methods
  getCategories: getProductCategories,
  getTags: getProductTags,
  getImages: getProductImages,
  getVariationIds: getProductVariationIds,
  // Batch related data
  batchGetCategories: batchGetProductCategories,
  batchGetTags: batchGetProductTags,
  batchGetImages: batchGetProductImages,
  batchGetVariationIds: batchGetProductVariationIds,
};

export default productService;
