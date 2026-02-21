/**
 * Reports Service
 */

import { db } from '../db';
import { orders, orderItems, orderRefunds } from '../db/schema/orders';
import { products } from '../db/schema/products';
import { customers } from '../db/schema/customers';
import { coupons } from '../db/schema/coupons';
import { sql, and, gte, lte, eq } from 'drizzle-orm';

interface DateRange {
  dateMin?: Date;
  dateMax?: Date;
}

const getDateRange = (period: string, dateMin?: string, dateMax?: string): DateRange => {
  if (dateMin || dateMax) {
    return {
      dateMin: dateMin ? new Date(dateMin) : undefined,
      dateMax: dateMax ? new Date(dateMax) : undefined,
    };
  }
  
  const now = new Date();
  let min: Date;
  
  switch (period) {
    case 'week':
      min = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      min = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      min = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case 'year':
      min = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      min = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  return { dateMin: min, dateMax: now };
};

export const getSalesReport = async (
  period: string = 'week',
  dateMin?: string,
  dateMax?: string
) => {
  const range = getDateRange(period, dateMin, dateMax);
  const conditions = [eq(orders.isDeleted, false)];
  
  if (range.dateMin) conditions.push(gte(orders.dateCreated, range.dateMin));
  if (range.dateMax) conditions.push(lte(orders.dateCreated, range.dateMax));
  
  // Get totals
  const [totals] = await db
    .select({
      totalSales: sql<string>`COALESCE(SUM(total::numeric), 0)`,
      totalTax: sql<string>`COALESCE(SUM(total_tax::numeric), 0)`,
      totalShipping: sql<string>`COALESCE(SUM(shipping_total::numeric), 0)`,
      totalDiscount: sql<string>`COALESCE(SUM(discount_total::numeric), 0)`,
      orderCount: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(and(...conditions));
  
  // Get total items
  const [items] = await db
    .select({ count: sql<number>`COALESCE(SUM(quantity), 0)` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(...conditions, eq(orders.isDeleted, false)));
  
  // Get refunds
  const [refunds] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
    .from(orderRefunds)
    .innerJoin(orders, eq(orderRefunds.orderId, orders.id))
    .where(and(...conditions, eq(orders.isDeleted, false)));
  
  // Get unique customers
  const [customerCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT customer_id)` })
    .from(orders)
    .where(and(...conditions));
  
  const totalSales = parseFloat(totals?.totalSales ?? '0');
  const totalShipping = parseFloat(totals?.totalShipping ?? '0');
  const totalTax = parseFloat(totals?.totalTax ?? '0');
  const totalDiscount = parseFloat(totals?.totalDiscount ?? '0');
  const totalRefunds = parseFloat(refunds?.total ?? '0');
  const netRevenue = totalSales - totalRefunds - totalDiscount;
  const orderCount = totals?.orderCount ?? 0;
  const averageSales = orderCount > 0 ? netRevenue / orderCount : 0;
  
  return [{
    total_sales: totalSales.toFixed(2),
    net_revenue: netRevenue.toFixed(2),
    average_sales: averageSales.toFixed(2),
    total_orders: orderCount,
    total_items: Number(items?.count ?? 0),
    total_tax: totalTax.toFixed(2),
    total_shipping: totalShipping.toFixed(2),
    total_refunds: totalRefunds.toFixed(2),
    total_discount: totalDiscount.toFixed(2),
    totals_grouped_by: period,
    totals: {},
    total_customers: Number(customerCount?.count ?? 0),
  }];
};

export const getTopSellersReport = async (
  period: string = 'week',
  dateMin?: string,
  dateMax?: string
) => {
  const range = getDateRange(period, dateMin, dateMax);
  const conditions = [eq(orders.isDeleted, false)];
  
  if (range.dateMin) conditions.push(gte(orders.dateCreated, range.dateMin));
  if (range.dateMax) conditions.push(lte(orders.dateCreated, range.dateMax));
  
  const results = await db
    .select({
      productId: orderItems.productId,
      name: orderItems.name,
      qty: sql<number>`SUM(quantity)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(...conditions))
    .groupBy(orderItems.productId, orderItems.name)
    .orderBy(sql`SUM(quantity) DESC`)
    .limit(10);
  
  return results.map((item, index) => ({
    title: item.name,
    product_id: item.productId,
    qty: item.qty,
  }));
};

export const getOrdersTotals = async () => {
  const results = await db
    .select({
      status: orders.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(eq(orders.isDeleted, false))
    .groupBy(orders.status);
  
  return results.map(r => ({
    slug: r.status,
    name: r.status.charAt(0).toUpperCase() + r.status.slice(1).replace('-', ' '),
    total: r.count,
  }));
};

export const getProductsTotals = async () => {
  const [result] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      published: sql<number>`COALESCE(SUM(CASE WHEN status = 'publish' THEN 1 ELSE 0 END), 0)`,
    })
    .from(products)
    .where(eq(products.isDeleted, false));
  
  return [
    { slug: 'all', name: 'All', total: result?.total ?? 0 },
    { slug: 'published', name: 'Published', total: result?.published ?? 0 },
  ];
};

export const getCustomersTotals = async () => {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(customers)
    .where(eq(customers.isDeleted, false));
  
  return [{ slug: 'customers', name: 'Customers', total: result?.count ?? 0 }];
};

export const getCouponsTotals = async () => {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(coupons)
    .where(eq(coupons.isDeleted, false));
  
  return [{ slug: 'coupons', name: 'Coupons', total: result?.count ?? 0 }];
};

export const getReviewsTotals = async () => {
  // TODO: Implement when reviews are added
  return [{ slug: 'reviews', name: 'Reviews', total: 0 }];
};

export const reportService = {
  getSalesReport,
  getTopSellersReport,
  getOrdersTotals,
  getProductsTotals,
  getCustomersTotals,
  getCouponsTotals,
  getReviewsTotals,
};

export default reportService;
