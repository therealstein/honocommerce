/**
 * Variation Response Formatter
 */

import type { ProductVariation } from '../db/schema/product-variations';
import { buildLinks, formatDate, formatDateGmt } from './wc-response';

interface VariationAttribute {
  id: number;
  name: string;
  option: string;
}

export interface VariationResponse {
  id: number;
  date_created: string | null;
  date_created_gmt: string | null;
  date_modified: string | null;
  date_modified_gmt: string | null;
  description: string;
  permalink: string;
  sku: string | null;
  price: string;
  regular_price: string;
  sale_price: string;
  date_on_sale_from: string | null;
  date_on_sale_from_gmt: string | null;
  date_on_sale_to: string | null;
  date_on_sale_to_gmt: string | null;
  on_sale: boolean;
  status: string;
  purchasable: boolean;
  virtual: boolean;
  downloadable: boolean;
  downloads: unknown[];
  download_limit: number;
  download_expiry: number;
  tax_status: string;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  backorders: string;
  backorders_allowed: boolean;
  backordered: boolean;
  weight: string;
  dimensions: { length: string; width: string; height: string };
  shipping_class: string;
  shipping_class_id: number;
  image: { id: number; src: string; name: string; alt: string } | null;
  attributes: VariationAttribute[];
  menu_order: number;
  meta_data: unknown[];
  _links: Record<string, Array<{ href: string }>>;
}

export const formatVariationResponse = (
  variation: ProductVariation,
  productId: number,
  attributes: VariationAttribute[] = []
): VariationResponse => {
  const regularPrice = variation.regularPrice ?? '';
  const salePrice = variation.salePrice ?? '';
  
  return {
    id: variation.id,
    date_created: formatDate(variation.dateCreated),
    date_created_gmt: formatDateGmt(variation.dateCreatedGmt),
    date_modified: formatDate(variation.dateModified),
    date_modified_gmt: formatDateGmt(variation.dateModifiedGmt),
    description: variation.description ?? '',
    permalink: `http://localhost:3000/product/?attribute=${variation.id}`,
    sku: variation.sku,
    price: variation.price ?? '',
    regular_price: regularPrice,
    sale_price: salePrice,
    date_on_sale_from: formatDate(variation.dateOnSaleFrom),
    date_on_sale_from_gmt: formatDateGmt(variation.dateOnSaleFromGmt),
    date_on_sale_to: formatDate(variation.dateOnSaleTo),
    date_on_sale_to_gmt: formatDateGmt(variation.dateOnSaleToGmt),
    on_sale: salePrice !== '' && salePrice !== regularPrice,
    status: variation.status,
    purchasable: variation.status === 'publish',
    virtual: variation.virtual,
    downloadable: variation.downloadable,
    downloads: variation.downloads as unknown[],
    download_limit: variation.downloadLimit,
    download_expiry: variation.downloadExpiry,
    tax_status: variation.taxStatus,
    tax_class: variation.taxClass ?? '',
    manage_stock: variation.manageStock,
    stock_quantity: variation.stockQuantity,
    stock_status: variation.stockStatus,
    backorders: variation.backorders,
    backorders_allowed: variation.backorders === 'yes' || variation.backorders === 'notify',
    backordered: variation.stockStatus === 'onbackorder' && variation.backorders !== 'no',
    weight: variation.weight ?? '',
    dimensions: {
      length: variation.length ?? '',
      width: variation.width ?? '',
      height: variation.height ?? '',
    },
    shipping_class: '',
    shipping_class_id: variation.shippingClassId,
    image: null, // TODO: Look up image
    attributes,
    menu_order: variation.menuOrder,
    meta_data: [],
    _links: buildLinks(
      `/wp-json/wc/v3/products/${productId}/variations/${variation.id}`,
      `/wp-json/wc/v3/products/${productId}/variations`,
      { up: `/wp-json/wc/v3/products/${productId}` }
    ),
  };
};

export const formatVariationListResponse = (
  variations: ProductVariation[],
  productId: number,
  attributesMap: Map<number, VariationAttribute[]> = new Map()
): VariationResponse[] =>
  variations.map(v => formatVariationResponse(v, productId, attributesMap.get(v.id) ?? []));
