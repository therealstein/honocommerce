/**
 * Order Types
 * TypeScript types for order resources
 */

// Order status
export type OrderStatus = 
  | 'pending' 
  | 'processing' 
  | 'on-hold' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded' 
  | 'failed'
  | 'trash';

// Address
export interface BillingAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email: string;
  phone: string;
}

export interface ShippingAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

// Order line item
export interface OrderLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  tax_class: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
  taxes: OrderLineTax[];
  meta_data: MetaDataItem[];
  sku: string;
  price: number;
}

export interface OrderLineTax {
  id: number;
  total: string;
  subtotal: string;
}

// Order tax line
export interface OrderTaxLine {
  id: number;
  rate_code: string;
  rate_id: number;
  label: string;
  compound: boolean;
  tax_total: string;
  shipping_tax_total: string;
  meta_data: MetaDataItem[];
}

// Order shipping line
export interface OrderShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  total: string;
  total_tax: string;
  taxes: OrderLineTax[];
  meta_data: MetaDataItem[];
}

// Order fee line
export interface OrderFeeLine {
  id: number;
  name: string;
  tax_class: string;
  tax_status: 'taxable' | 'none';
  total: string;
  total_tax: string;
  taxes: OrderLineTax[];
  meta_data: MetaDataItem[];
}

// Order coupon line
export interface OrderCouponLine {
  id: number;
  code: string;
  discount: string;
  discount_tax: string;
  meta_data: MetaDataItem[];
}

// Order refund
export interface OrderRefund {
  id: number;
  code: string;
  reason: string | null;
  total: string;
  date_created: string;
  date_created_gmt: string;
  meta_data: MetaDataItem[];
  _links: ApiLinks;
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
  customer?: Array<{ href: string }>;
  up?: Array<{ href: string }>;
}

// Full Order response (WooCommerce format)
export interface OrderResponse {
  id: number;
  parent_id: number;
  number: string;
  order_key: string;
  created_via: string;
  version: string;
  status: OrderStatus;
  currency: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  prices_include_tax: boolean;
  customer_id: number;
  customer_ip_address: string;
  customer_user_agent: string;
  customer_note: string;
  billing: BillingAddress;
  shipping: ShippingAddress;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  date_paid: string | null;
  date_paid_gmt: string | null;
  date_completed: string | null;
  date_completed_gmt: string | null;
  cart_hash: string;
  meta_data: MetaDataItem[];
  line_items: OrderLineItem[];
  tax_lines: OrderTaxLine[];
  shipping_lines: OrderShippingLine[];
  fee_lines: OrderFeeLine[];
  coupon_lines: OrderCouponLine[];
  refunds: Array<{ id: number; reason: string | null }>;
  currency_symbol: string;
  _links: ApiLinks;
}
