/**
 * Product Types
 * TypeScript types for product resources
 */

// Product types
export type ProductType = 'simple' | 'grouped' | 'external' | 'variable';
export type ProductStatus = 'draft' | 'pending' | 'private' | 'publish';
export type CatalogVisibility = 'visible' | 'catalog' | 'search' | 'hidden';
export type TaxStatus = 'taxable' | 'shipping' | 'none';
export type StockStatus = 'instock' | 'outofstock' | 'onbackorder';
export type Backorders = 'no' | 'notify' | 'yes';

// Product dimension
export interface ProductDimension {
  length: string;
  width: string;
  height: string;
}

// Product image
export interface ProductImage {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  src: string;
  name: string;
  alt: string;
}

// Product category (embedded)
export interface ProductCategoryEmbedded {
  id: number;
  name: string;
  slug: string;
}

// Product tag (embedded)
export interface ProductTagEmbedded {
  id: number;
  name: string;
  slug: string;
}

// Product attribute
export interface ProductAttribute {
  id: number;
  name: string;
  position: number;
  visible: boolean;
  variation: boolean;
  options: string[];
}

// Default attribute
export interface ProductDefaultAttribute {
  id: number;
  name: string;
  option: string;
}

// Product download
export interface ProductDownload {
  id: string;
  name: string;
  file: string;
}

// Meta data item
export interface MetaDataItem {
  id: number;
  key: string;
  value: string | number | boolean | null;
}

// API Links
export interface ApiLinks {
  self: Array<{ href: string }>;
  collection: Array<{ href: string }>;
  up?: Array<{ href: string }>;
}

// Full Product response (WooCommerce format)
export interface ProductResponse {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  type: ProductType;
  status: ProductStatus;
  featured: boolean;
  catalog_visibility: CatalogVisibility;
  description: string;
  short_description: string;
  sku: string;
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
  downloads: ProductDownload[];
  download_limit: number;
  download_expiry: number;
  external_url: string;
  button_text: string;
  tax_status: TaxStatus;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: StockStatus;
  backorders: Backorders;
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight: string;
  dimensions: ProductDimension;
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
  purchase_note: string;
  categories: ProductCategoryEmbedded[];
  tags: ProductTagEmbedded[];
  images: ProductImage[];
  attributes: ProductAttribute[];
  default_attributes: ProductDefaultAttribute[];
  variations: number[];
  grouped_products: number[];
  menu_order: number;
  meta_data: MetaDataItem[];
  _links: ApiLinks;
}

// Product variation response
export interface ProductVariationResponse {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  description: string;
  permalink: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  date_on_sale_from: string | null;
  date_on_sale_from_gmt: string | null;
  date_on_sale_to: string | null;
  date_on_sale_to_gmt: string | null;
  on_sale: boolean;
  status: ProductStatus;
  purchasable: boolean;
  virtual: boolean;
  downloadable: boolean;
  downloads: ProductDownload[];
  download_limit: number;
  download_expiry: number;
  tax_status: TaxStatus;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: StockStatus;
  backorders: Backorders;
  backorders_allowed: boolean;
  backordered: boolean;
  weight: string;
  dimensions: ProductDimension;
  shipping_class: string;
  shipping_class_id: number;
  image: ProductImage | null;
  attributes: ProductDefaultAttribute[];
  menu_order: number;
  meta_data: MetaDataItem[];
  _links: ApiLinks;
}
