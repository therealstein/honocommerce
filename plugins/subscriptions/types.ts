/**
 * Subscription Types
 * Type definitions for the WooCommerce Subscriptions plugin
 */

// ============== ADDRESS TYPES ==============

export interface SubscriptionBillingAddress {
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

export interface SubscriptionShippingAddress {
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

// ============== LINE ITEM TYPES ==============

export interface SubscriptionLineItemTax {
  id: number;
  total: string;
  subtotal: string;
}

export interface SubscriptionLineItem {
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
  taxes: SubscriptionLineItemTax[];
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  sku: string | null;
  price: number | null;
}

export interface SubscriptionShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  instance_id: string | null;
  total: string;
  total_tax: string;
  taxes: SubscriptionLineItemTax[];
  meta_data: Array<{ id: number; key: string; value: unknown }>;
}

export interface SubscriptionTaxLine {
  id: number;
  rate_code: string;
  rate_id: number;
  label: string;
  compound: boolean;
  tax_total: string;
  shipping_tax_total: string;
  rate_percent: number | null;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
}

export interface SubscriptionFeeLine {
  id: number;
  name: string;
  tax_class: string;
  tax_status: string;
  total: string;
  total_tax: string;
  taxes: SubscriptionLineItemTax[];
  meta_data: Array<{ id: number; key: string; value: unknown }>;
}

export interface SubscriptionCouponLine {
  id: number;
  code: string;
  discount: string;
  discount_tax: string;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
}

export interface SubscriptionNote {
  id: number;
  subscription_id: number;
  note: string;
  author: string | null;
  date_created: Date;
  date_created_gmt: Date;
  is_customer_note: boolean;
  added_by_user: boolean;
}

// ============== MAIN SUBSCRIPTION TYPE ==============

export interface Subscription {
  id: number;
  parent_id: number;
  number: string | null;
  order_key: string | null;
  created_via: string | null;
  version: string | null;
  status: string;
  currency: string;
  date_created: Date;
  date_created_gmt: Date;
  date_modified: Date;
  date_modified_gmt: Date;
  date_completed: Date | null;
  date_completed_gmt: Date | null;
  date_paid: Date | null;
  date_paid_gmt: Date | null;
  
  // Subscription-specific dates
  start_date_gmt: Date;
  trial_end_date_gmt: Date | null;
  next_payment_date_gmt: Date | null;
  last_payment_date_gmt: Date | null;
  cancelled_date_gmt: Date | null;
  end_date_gmt: Date | null;
  payment_retry_date_gmt: Date | null;
  
  // Totals
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  prices_include_tax: boolean;
  
  // Customer
  customer_id: number;
  customer_note: string | null;
  customer_ip_address: string | null;
  customer_user_agent: string | null;
  
  // Billing
  billing_period: string;
  billing_interval: number;
  
  // Payment
  payment_method: string | null;
  payment_method_title: string | null;
  transaction_id: string | null;
  payment_details: Record<string, unknown> | null;
  
  // Addresses
  billing: SubscriptionBillingAddress;
  shipping: SubscriptionShippingAddress;
  
  // Resubscribe
  resubscribed_from: number | null;
  resubscribed_subscription: number | null;
  
  // Meta
  meta_data: Array<{ key: string; value: unknown }>;
  is_deleted: boolean;
}

// ============== RESPONSE TYPES ==============

export interface SubscriptionResponse {
  id: number;
  parent_id: number;
  number: string | null;
  order_key: string | null;
  created_via: string | null;
  version: string | null;
  status: string;
  currency: string;
  date_created: string | null;
  date_created_gmt: string | null;
  date_modified: string | null;
  date_modified_gmt: string | null;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  prices_include_tax: boolean;
  customer_id: number;
  customer_ip_address: string | null;
  customer_user_agent: string | null;
  customer_note: string | null;
  billing: SubscriptionBillingAddress;
  shipping: SubscriptionShippingAddress;
  payment_method: string | null;
  payment_method_title: string | null;
  transaction_id: string | null;
  date_paid: string | null;
  date_paid_gmt: string | null;
  date_completed: string | null;
  date_completed_gmt: string | null;
  billing_period: string;
  billing_interval: number;
  start_date_gmt: string | null;
  trial_end_date_gmt: string | null;
  next_payment_date_gmt: string | null;
  last_payment_date_gmt: string | null;
  cancelled_date_gmt: string | null;
  end_date_gmt: string | null;
  payment_retry_date_gmt: string | null;
  resubscribed_from: number | null;
  resubscribed_subscription: number | null;
  line_items: SubscriptionLineItem[];
  tax_lines: SubscriptionTaxLine[];
  shipping_lines: SubscriptionShippingLine[];
  fee_lines: SubscriptionFeeLine[];
  coupon_lines: SubscriptionCouponLine[];
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  currency_symbol: string;
  _links: Record<string, Array<{ href: string }>>;
}

export interface SubscriptionNoteResponse {
  id: number;
  date_created: string | null;
  date_created_gmt: string | null;
  note: string;
  author: string | null;
  is_customer_note: boolean;
  added_by_user: boolean;
  _links: Record<string, Array<{ href: string }>>;
}

// ============== STATUS TYPE ==============

export type SubscriptionStatus = 
  | 'pending'
  | 'active'
  | 'on-hold'
  | 'cancelled'
  | 'switched'
  | 'expired'
  | 'pending-cancel';

export type BillingPeriod = 'day' | 'week' | 'month' | 'year';
