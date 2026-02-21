/**
 * Product Response Formatter
 * Formats product data to match WooCommerce v3 JSON contract exactly
 */

import type { Product } from '../db/schema/products';
import { buildLinks, formatDate, formatDateGmt, formatMoney } from './wc-response';

/**
 * Dimensions object shape
 */
interface Dimensions {
  length: string;
  width: string;
  height: string;
}

/**
 * Category object for response
 */
interface CategoryResponse {
  id: number;
  name: string;
  slug: string;
}

/**
 * Tag object for response
 */
interface TagResponse {
  id: number;
  name: string;
  slug: string;
}

/**
 * Image object for response
 */
interface ImageResponse {
  id: number;
  date_created: string | null;
  date_created_gmt: string | null;
  date_modified: string | null;
  date_modified_gmt: string | null;
  src: string;
  name: string;
  alt: string;
}

/**
 * Attribute object for response
 */
interface AttributeResponse {
  id: number;
  name: string;
  position: number;
  visible: boolean;
  variation: boolean;
  options: string[];
}

/**
 * Meta data object for response
 */
interface MetaDataResponse {
  id: number;
  key: string;
  value: unknown;
}

/**
 * Full WooCommerce Product Response shape
 */
export interface ProductResponse {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string | null;
  date_created_gmt: string | null;
  date_modified: string | null;
  date_modified_gmt: string | null;
  type: string;
  status: string;
  featured: boolean;
  catalog_visibility: string;
  description: string | null;
  short_description: string | null;
  sku: string | null;
  price: string;
  regular_price: string;
  sale_price: string;
  date_on_sale_from: string | null;
  date_on_sale_from_gmt: string | null;
  date_on_sale_to: string | null;
  date_on_sale_to_gmt: string | null;
  price_html: string;
  on_sale: boolean;
  purchasable: boolean;
  total_sales: number;
  virtual: boolean;
  downloadable: boolean;
  downloads: Array<{ id: string; name: string; file: string }>;
  download_limit: number;
  download_expiry: number;
  external_url: string;
  button_text: string;
  tax_status: string;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  backorders: string;
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight: string;
  dimensions: Dimensions;
  shipping_required: boolean;
  shipping_taxable: boolean;
  shipping_class: string;
  shipping_class_id: number;
  reviews_allowed: boolean;
  average_rating: string;
  rating_count: number;
  related_ids: number[];
  upsell_ids: number[];
  cross_sell_ids: number[];
  parent_id: number;
  purchase_note: string | null;
  categories: CategoryResponse[];
  tags: TagResponse[];
  images: ImageResponse[];
  attributes: AttributeResponse[];
  default_attributes: AttributeResponse[];
  variations: number[];
  grouped_products: number[];
  menu_order: number;
  meta_data: MetaDataResponse[];
  _links: Record<string, Array<{ href: string }>>;
}

/**
 * Generate price HTML
 */
const generatePriceHtml = (
  price: string,
  regularPrice: string,
  salePrice: string,
  onSale: boolean
): string => {
  if (!price) return '';
  
  if (onSale && salePrice && regularPrice) {
    return `<del><span class="woocommerce-Price-amount amount">${regularPrice}</span></del> <ins><span class="woocommerce-Price-amount amount">${salePrice}</span></ins>`;
  }
  
  return `<span class="woocommerce-Price-amount amount">${price}</span>`;
};

/**
 * Format a product for API response
 */
export const formatProductResponse = (
  product: Product,
  options?: {
    categories?: CategoryResponse[];
    tags?: TagResponse[];
    images?: ImageResponse[];
    attributes?: AttributeResponse[];
    variations?: number[];
  }
): ProductResponse => {
  const regularPrice = product.regularPrice ?? '';
  const salePrice = product.salePrice ?? '';
  const price = product.price ?? '';
  const onSale = salePrice !== '' && salePrice !== regularPrice;
  
  const dimensions: Dimensions = {
    length: product.length ?? '',
    width: product.width ?? '',
    height: product.height ?? '',
  };
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    permalink: `${baseUrl}/product/${product.slug}/`,
    date_created: formatDate(product.dateCreated),
    date_created_gmt: formatDateGmt(product.dateCreatedGmt),
    date_modified: formatDate(product.dateModified),
    date_modified_gmt: formatDateGmt(product.dateModifiedGmt),
    type: product.type,
    status: product.status,
    featured: product.featured,
    catalog_visibility: product.catalogVisibility,
    description: product.description ?? '',
    short_description: product.shortDescription ?? '',
    sku: product.sku,
    price: price,
    regular_price: regularPrice,
    sale_price: salePrice,
    date_on_sale_from: formatDate(product.dateOnSaleFrom),
    date_on_sale_from_gmt: formatDateGmt(product.dateOnSaleFromGmt),
    date_on_sale_to: formatDate(product.dateOnSaleTo),
    date_on_sale_to_gmt: formatDateGmt(product.dateOnSaleToGmt),
    price_html: generatePriceHtml(price, regularPrice, salePrice, onSale),
    on_sale: onSale,
    purchasable: product.status === 'publish',
    total_sales: product.totalSales,
    virtual: product.virtual,
    downloadable: product.downloadable,
    downloads: Array.isArray(product.downloads) ? product.downloads as Array<{ id: string; name: string; file: string }> : [],
    download_limit: product.downloadLimit,
    download_expiry: product.downloadExpiry,
    external_url: product.externalUrl ?? '',
    button_text: product.buttonText ?? '',
    tax_status: product.taxStatus,
    tax_class: product.taxClass ?? '',
    manage_stock: product.manageStock,
    stock_quantity: product.stockQuantity,
    stock_status: product.stockStatus,
    backorders: product.backorders,
    backorders_allowed: product.backorders === 'yes' || product.backorders === 'notify',
    backordered: product.stockStatus === 'onbackorder' && product.backorders !== 'no',
    sold_individually: product.soldIndividually,
    weight: product.weight ?? '',
    dimensions,
    shipping_required: !product.virtual && (product.weight !== null || product.length !== null),
    shipping_taxable: product.taxStatus === 'taxable',
    shipping_class: '', // TODO: Look up shipping class name
    shipping_class_id: product.shippingClassId,
    reviews_allowed: product.reviewsAllowed,
    average_rating: '0.00', // TODO: Calculate from reviews
    rating_count: 0, // TODO: Count reviews
    related_ids: [], // TODO: Calculate related products
    upsell_ids: [], // TODO: Store and retrieve
    cross_sell_ids: [], // TODO: Store and retrieve
    parent_id: product.parentId,
    purchase_note: product.purchaseNote,
    categories: options?.categories ?? [],
    tags: options?.tags ?? [],
    images: options?.images ?? [],
    attributes: options?.attributes ?? [],
    default_attributes: [],
    variations: options?.variations ?? [],
    grouped_products: [],
    menu_order: product.menuOrder,
    meta_data: [], // TODO: Retrieve from meta table
    _links: buildLinks(
      `/wp-json/wc/v3/products/${product.id}`,
      '/wp-json/wc/v3/products'
    ),
  };
};

/**
 * Format multiple products for list response
 */
export const formatProductListResponse = (
  products: Product[]
): ProductResponse[] => {
  return products.map(product => formatProductResponse(product));
};
