/**
 * Data Export Service
 * Export products, orders, customers to CSV
 */

import { db } from '../db';
import { products } from '../db/schema/products';
import { orders, orderItems, orderShippingLines, orderCouponLines } from '../db/schema/orders';
import { customers } from '../db/schema/customers';
import { coupons } from '../db/schema/coupons';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { objectsToCsv, formatDateForCsv, formatDateTimeForCsv, formatBooleanForCsv } from '../lib/csv-utils';

// ============== PRODUCT EXPORT ==============

export interface ProductExportRow {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  featured: string;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: string;
  stock_status: string;
  manage_stock: string;
  categories: string;
  tags: string;
  images: string;
  date_created: string;
}

export const exportProducts = async (options?: {
  status?: string;
  category?: number;
  dateMin?: string;
  dateMax?: string;
}): Promise<string> => {
  const conditions = [eq(products.isDeleted, false)];
  
  if (options?.status) {
    conditions.push(eq(products.status, options.status));
  }
  
  if (options?.dateMin) {
    conditions.push(gte(products.dateCreated, new Date(options.dateMin)));
  }
  
  if (options?.dateMax) {
    conditions.push(lte(products.dateCreated, new Date(options.dateMax)));
  }
  
  const items = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.id));
  
  const rows: ProductExportRow[] = items.map(p => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    status: p.status,
    featured: formatBooleanForCsv(p.featured),
    description: (p.description ?? '').replace(/\n/g, '\\n'),
    short_description: (p.shortDescription ?? '').replace(/\n/g, '\\n'),
    sku: p.sku ?? '',
    price: p.price ?? '',
    regular_price: p.regularPrice ?? '',
    sale_price: p.salePrice ?? '',
    stock_quantity: String(p.stockQuantity ?? ''),
    stock_status: p.stockStatus,
    manage_stock: formatBooleanForCsv(p.manageStock),
    categories: '', // Would need to join with categories
    tags: '', // Would need to join with tags
    images: '', // Would need to format image URLs
    date_created: formatDateForCsv(p.dateCreated),
  }));
  
  return objectsToCsv(rows);
};

// ============== ORDER EXPORT ==============

export interface OrderExportRow {
  id: number;
  status: string;
  currency: string;
  total: string;
  subtotal: string;
  shipping_total: string;
  discount_total: string;
  total_tax: string;
  customer_id: string;
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  billing_first_name: string;
  billing_last_name: string;
  billing_email: string;
  billing_phone: string;
  billing_address_1: string;
  billing_city: string;
  billing_state: string;
  billing_postcode: string;
  billing_country: string;
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_address_1: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postcode: string;
  shipping_country: string;
  payment_method: string;
  payment_method_title: string;
  date_created: string;
  date_paid: string;
  date_completed: string;
}

export const exportOrders = async (options?: {
  status?: string;
  customer?: number;
  dateMin?: string;
  dateMax?: string;
}): Promise<string> => {
  const conditions = [eq(orders.isDeleted, false)];
  
  if (options?.status) {
    conditions.push(eq(orders.status, options.status));
  }
  
  if (options?.customer) {
    conditions.push(eq(orders.customerId, options.customer));
  }
  
  if (options?.dateMin) {
    conditions.push(gte(orders.dateCreated, new Date(options.dateMin)));
  }
  
  if (options?.dateMax) {
    conditions.push(lte(orders.dateCreated, new Date(options.dateMax)));
  }
  
  const items = await db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.id));
  
  const rows: OrderExportRow[] = items.map(o => {
    const billing = o.billing as Record<string, string> | null;
    const shipping = o.shipping as Record<string, string> | null;
    
    return {
      id: o.id,
      status: o.status,
      currency: o.currency,
      total: o.total,
      subtotal: '0.00', // Calculate from line items
      shipping_total: o.shippingTotal,
      discount_total: o.discountTotal,
      total_tax: o.totalTax,
      customer_id: String(o.customerId),
      customer_email: billing?.email ?? '',
      customer_first_name: billing?.first_name ?? '',
      customer_last_name: billing?.last_name ?? '',
      billing_first_name: billing?.first_name ?? '',
      billing_last_name: billing?.last_name ?? '',
      billing_email: billing?.email ?? '',
      billing_phone: billing?.phone ?? '',
      billing_address_1: billing?.address_1 ?? '',
      billing_city: billing?.city ?? '',
      billing_state: billing?.state ?? '',
      billing_postcode: billing?.postcode ?? '',
      billing_country: billing?.country ?? '',
      shipping_first_name: shipping?.first_name ?? '',
      shipping_last_name: shipping?.last_name ?? '',
      shipping_address_1: shipping?.address_1 ?? '',
      shipping_city: shipping?.city ?? '',
      shipping_state: shipping?.state ?? '',
      shipping_postcode: shipping?.postcode ?? '',
      shipping_country: shipping?.country ?? '',
      payment_method: o.paymentMethod ?? '',
      payment_method_title: o.paymentMethodTitle ?? '',
      date_created: formatDateTimeForCsv(o.dateCreated),
      date_paid: formatDateTimeForCsv(o.datePaid),
      date_completed: formatDateTimeForCsv(o.dateCompleted),
    };
  });
  
  return objectsToCsv(rows);
};

// ============== CUSTOMER EXPORT ==============

export interface CustomerExportRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  billing_first_name: string;
  billing_last_name: string;
  billing_email: string;
  billing_phone: string;
  billing_address_1: string;
  billing_city: string;
  billing_state: string;
  billing_postcode: string;
  billing_country: string;
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_address_1: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postcode: string;
  shipping_country: string;
  date_created: string;
  orders_count: string;
  total_spent: string;
}

export const exportCustomers = async (options?: {
  role?: string;
  dateMin?: string;
  dateMax?: string;
}): Promise<string> => {
  const conditions = [eq(customers.isDeleted, false)];
  
  if (options?.role) {
    conditions.push(eq(customers.role, options.role));
  }
  
  if (options?.dateMin) {
    conditions.push(gte(customers.dateCreated, new Date(options.dateMin)));
  }
  
  if (options?.dateMax) {
    conditions.push(lte(customers.dateCreated, new Date(options.dateMax)));
  }
  
  const items = await db
    .select()
    .from(customers)
    .where(and(...conditions))
    .orderBy(desc(customers.id));
  
  const rows: CustomerExportRow[] = items.map(c => {
    const billing = c.billing as Record<string, string> | null;
    const shipping = c.shipping as Record<string, string> | null;
    
    return {
      id: c.id,
      email: c.email,
      first_name: c.firstName ?? '',
      last_name: c.lastName ?? '',
      username: c.username ?? '',
      role: c.role,
      billing_first_name: billing?.first_name ?? '',
      billing_last_name: billing?.last_name ?? '',
      billing_email: billing?.email ?? '',
      billing_phone: billing?.phone ?? '',
      billing_address_1: billing?.address_1 ?? '',
      billing_city: billing?.city ?? '',
      billing_state: billing?.state ?? '',
      billing_postcode: billing?.postcode ?? '',
      billing_country: billing?.country ?? '',
      shipping_first_name: shipping?.first_name ?? '',
      shipping_last_name: shipping?.last_name ?? '',
      shipping_address_1: shipping?.address_1 ?? '',
      shipping_city: shipping?.city ?? '',
      shipping_state: shipping?.state ?? '',
      shipping_postcode: shipping?.postcode ?? '',
      shipping_country: shipping?.country ?? '',
      date_created: formatDateForCsv(c.dateCreated),
      orders_count: '0',
      total_spent: '0.00',
    };
  });
  
  return objectsToCsv(rows);
};

// ============== COUPON EXPORT ==============

export interface CouponExportRow {
  id: number;
  code: string;
  amount: string;
  discount_type: string;
  description: string;
  expiry_date: string;
  usage_count: string;
  individual_use: string;
  product_ids: string;
  usage_limit: string;
  free_shipping: string;
  minimum_amount: string;
  maximum_amount: string;
  date_created: string;
}

export const exportCoupons = async (options?: {
  type?: string;
  dateMin?: string;
  dateMax?: string;
}): Promise<string> => {
  const conditions = [eq(coupons.isDeleted, false)];
  
  if (options?.type) {
    conditions.push(eq(coupons.discountType, options.type));
  }
  
  if (options?.dateMin) {
    conditions.push(gte(coupons.dateCreated, new Date(options.dateMin)));
  }
  
  if (options?.dateMax) {
    conditions.push(lte(coupons.dateCreated, new Date(options.dateMax)));
  }
  
  const items = await db
    .select()
    .from(coupons)
    .where(and(...conditions))
    .orderBy(desc(coupons.id));
  
  const rows: CouponExportRow[] = items.map(c => ({
    id: c.id,
    code: c.code,
    amount: c.amount,
    discount_type: c.discountType,
    description: c.description ?? '',
    expiry_date: formatDateForCsv(c.dateExpires),
    usage_count: String(c.usageCount),
    individual_use: formatBooleanForCsv(c.individualUse),
    product_ids: (c.productIds as number[])?.join(';') ?? '',
    usage_limit: String(c.usageLimit ?? ''),
    free_shipping: formatBooleanForCsv(c.freeShipping),
    minimum_amount: c.minimumAmount ?? '',
    maximum_amount: c.maximumAmount ?? '',
    date_created: formatDateForCsv(c.dateCreated),
  }));
  
  return objectsToCsv(rows);
};

// ============== SERVICE EXPORT ==============

export const exportService = {
  products: exportProducts,
  orders: exportOrders,
  customers: exportCustomers,
  coupons: exportCoupons,
};

export default exportService;
