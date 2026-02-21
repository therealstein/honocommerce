/**
 * WooCommerce API Types
 * Full WooCommerce API type surface
 */

// Re-export all resource types
export * from './product.types';
export * from './order.types';

// Common types
export interface PaginationQuery {
  context?: 'view' | 'edit';
  page?: number;
  per_page?: number;
  search?: string;
  after?: string;
  before?: string;
  exclude?: number[];
  include?: number[];
  offset?: number;
  order?: 'asc' | 'desc';
  orderby?: 'date' | 'id' | 'title' | 'slug' | 'include';
}

// Customer types
export interface CustomerResponse {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  username: string;
  billing: BillingAddress;
  shipping: ShippingAddress;
  is_paying_customer: boolean;
  avatar_url: string;
  meta_data: MetaDataItem[];
  _links: ApiLinks;
}

// Coupon types
export type CouponDiscountType = 'percent' | 'fixed_cart' | 'fixed_product';

export interface CouponResponse {
  id: number;
  code: string;
  amount: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  discount_type: CouponDiscountType;
  description: string;
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
  minimum_amount: string;
  maximum_amount: string;
  email_restrictions: string[];
  used_by: number[];
  meta_data: MetaDataItem[];
  _links: ApiLinks;
}

// Webhook types
export type WebhookStatus = 'active' | 'paused' | 'disabled';
export type WebhookTopic = 
  | 'coupon.created' | 'coupon.updated' | 'coupon.deleted'
  | 'customer.created' | 'customer.updated' | 'customer.deleted'
  | 'order.created' | 'order.updated' | 'order.deleted'
  | 'product.created' | 'product.updated' | 'product.deleted';

export interface WebhookResponse {
  id: number;
  name: string;
  status: WebhookStatus;
  topic: WebhookTopic;
  resource: string;
  event: string;
  hooks: string[];
  delivery_url: string;
  secret: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  _links: ApiLinks;
}

// Batch operation types
export interface BatchRequest<T> {
  create?: T[];
  update?: Array<T & { id: number }>;
  delete?: number[];
}

export interface BatchResponse<T> {
  create?: T[];
  update?: T[];
  delete?: T[];
}

// Error response
export interface WcErrorResponse {
  code: string;
  message: string;
  data: {
    status: number;
  };
}

// Import types from other files
import { BillingAddress, ShippingAddress, MetaDataItem, ApiLinks } from './order.types';
