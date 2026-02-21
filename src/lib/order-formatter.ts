/**
 * Order Response Formatter
 */

import type { Order, OrderItem, OrderRefund, OrderShippingLine, OrderTaxLine, OrderFeeLine, OrderCouponLine } from '../db/schema/orders';
import { buildLinks, formatDate, formatDateGmt } from './wc-response';

// Currency symbols map
const currencySymbols: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$',
  CHF: 'Fr', CNY: '¥', INR: '₹', BRL: 'R$', MXN: 'MX$',
};

export interface LineItemResponse {
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
  taxes: Array<{ id: number; total: string; subtotal: string }>;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  sku: string | null;
  price: number | null;
}

export interface ShippingLineResponse {
  id: number;
  method_title: string;
  method_id: string;
  total: string;
  total_tax: string;
  taxes: Array<{ id: number; total: string; subtotal: string }>;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
}

export interface TaxLineResponse {
  id: number;
  rate_code: string;
  rate_id: number;
  label: string;
  compound: boolean;
  tax_total: string;
  shipping_tax_total: string;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
}

export interface FeeLineResponse {
  id: number;
  name: string;
  tax_class: string;
  tax_status: string;
  total: string;
  total_tax: string;
  taxes: Array<{ id: number; total: string; subtotal: string }>;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
}

export interface CouponLineResponse {
  id: number;
  code: string;
  discount: string;
  discount_tax: string;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
}

export interface RefundResponse {
  id: number;
  date_created: string | null;
  date_created_gmt: string | null;
  amount: string;
  reason: string | null;
  refunded_by: number;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  _links: Record<string, Array<{ href: string }>>;
}

export interface OrderResponse {
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
  billing: {
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
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  payment_method: string | null;
  payment_method_title: string | null;
  transaction_id: string | null;
  date_paid: string | null;
  date_paid_gmt: string | null;
  date_completed: string | null;
  date_completed_gmt: string | null;
  cart_hash: string | null;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  line_items: LineItemResponse[];
  tax_lines: TaxLineResponse[];
  shipping_lines: ShippingLineResponse[];
  fee_lines: FeeLineResponse[];
  coupon_lines: CouponLineResponse[];
  refunds: RefundResponse[];
  currency_symbol: string;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatLineItemResponse = (item: OrderItem, index: number): LineItemResponse => ({
  id: item.id,
  name: item.name,
  product_id: item.productId,
  variation_id: item.variationId,
  quantity: item.quantity,
  tax_class: item.taxClass ?? '',
  subtotal: item.subtotal,
  subtotal_tax: item.subtotalTax,
  total: item.total,
  total_tax: item.totalTax,
  taxes: (item.taxes as Array<{ id: number; total: string; subtotal: string }>) ?? [],
  meta_data: (item.metaData as Array<{ id: number; key: string; value: unknown }>)?.map((m, i) => ({ ...m, id: i })) ?? [],
  sku: item.sku,
  price: item.price ? parseFloat(item.price) : null,
});

export const formatShippingLineResponse = (line: OrderShippingLine): ShippingLineResponse => ({
  id: line.id,
  method_title: line.methodTitle,
  method_id: line.methodId,
  total: line.total,
  total_tax: line.totalTax,
  taxes: (line.taxes as Array<{ id: number; total: string; subtotal: string }>) ?? [],
  meta_data: (line.metaData as Array<{ id: number; key: string; value: unknown }>)?.map((m, i) => ({ ...m, id: i })) ?? [],
});

export const formatTaxLineResponse = (line: OrderTaxLine): TaxLineResponse => ({
  id: line.id,
  rate_code: line.rateCode,
  rate_id: line.rateId,
  label: line.label,
  compound: line.compound,
  tax_total: line.taxTotal,
  shipping_tax_total: line.shippingTaxTotal,
  meta_data: (line.metaData as Array<{ id: number; key: string; value: unknown }>)?.map((m, i) => ({ ...m, id: i })) ?? [],
});

export const formatFeeLineResponse = (line: OrderFeeLine): FeeLineResponse => ({
  id: line.id,
  name: line.name,
  tax_class: line.taxClass ?? '',
  tax_status: line.taxStatus,
  total: line.total,
  total_tax: line.totalTax,
  taxes: (line.taxes as Array<{ id: number; total: string; subtotal: string }>) ?? [],
  meta_data: (line.metaData as Array<{ id: number; key: string; value: unknown }>)?.map((m, i) => ({ ...m, id: i })) ?? [],
});

export const formatCouponLineResponse = (line: OrderCouponLine): CouponLineResponse => ({
  id: line.id,
  code: line.code,
  discount: line.discount,
  discount_tax: line.discountTax,
  meta_data: (line.metaData as Array<{ id: number; key: string; value: unknown }>)?.map((m, i) => ({ ...m, id: i })) ?? [],
});

export const formatRefundResponse = (refund: OrderRefund): RefundResponse => ({
  id: refund.id,
  date_created: formatDate(refund.dateCreated),
  date_created_gmt: formatDateGmt(refund.dateCreatedGmt),
  amount: refund.amount,
  reason: refund.reason,
  refunded_by: 0, // TODO: track refunded_by
  meta_data: (refund.metaData as Array<{ id: number; key: string; value: unknown }>)?.map((m, i) => ({ ...m, id: i })) ?? [],
  _links: buildLinks(
    `/wp-json/wc/v3/orders/${refund.orderId}/refunds/${refund.id}`,
    `/wp-json/wc/v3/orders/${refund.orderId}/refunds`
  ),
});

export const formatOrderResponse = (
  order: Order,
  options?: {
    lineItems?: OrderItem[];
    shippingLines?: OrderShippingLine[];
    taxLines?: OrderTaxLine[];
    feeLines?: OrderFeeLine[];
    couponLines?: OrderCouponLine[];
    refunds?: OrderRefund[];
  }
): OrderResponse => {
  const currencySymbol = currencySymbols[order.currency] ?? order.currency;
  
  const billing = order.billing as OrderResponse['billing'];
  const shipping = order.shipping as OrderResponse['shipping'];
  
  return {
    id: order.id,
    parent_id: order.parentId,
    number: order.number,
    order_key: order.orderKey,
    created_via: order.createdVia,
    version: order.version,
    status: order.status,
    currency: order.currency,
    date_created: formatDate(order.dateCreated),
    date_created_gmt: formatDateGmt(order.dateCreatedGmt),
    date_modified: formatDate(order.dateModified),
    date_modified_gmt: formatDateGmt(order.dateModifiedGmt),
    discount_total: order.discountTotal,
    discount_tax: order.discountTax,
    shipping_total: order.shippingTotal,
    shipping_tax: order.shippingTax,
    cart_tax: order.cartTax,
    total: order.total,
    total_tax: order.totalTax,
    prices_include_tax: order.pricesIncludeTax,
    customer_id: order.customerId,
    customer_ip_address: order.customerIpAddress,
    customer_user_agent: order.customerUserAgent,
    customer_note: order.customerNote,
    billing: {
      first_name: billing?.first_name ?? '',
      last_name: billing?.last_name ?? '',
      company: billing?.company ?? '',
      address_1: billing?.address_1 ?? '',
      address_2: billing?.address_2 ?? '',
      city: billing?.city ?? '',
      state: billing?.state ?? '',
      postcode: billing?.postcode ?? '',
      country: billing?.country ?? '',
      email: billing?.email ?? '',
      phone: billing?.phone ?? '',
    },
    shipping: {
      first_name: shipping?.first_name ?? '',
      last_name: shipping?.last_name ?? '',
      company: shipping?.company ?? '',
      address_1: shipping?.address_1 ?? '',
      address_2: shipping?.address_2 ?? '',
      city: shipping?.city ?? '',
      state: shipping?.state ?? '',
      postcode: shipping?.postcode ?? '',
      country: shipping?.country ?? '',
    },
    payment_method: order.paymentMethod,
    payment_method_title: order.paymentMethodTitle,
    transaction_id: order.transactionId,
    date_paid: formatDate(order.datePaid),
    date_paid_gmt: formatDateGmt(order.datePaidGmt),
    date_completed: formatDate(order.dateCompleted),
    date_completed_gmt: formatDateGmt(order.dateCompletedGmt),
    cart_hash: order.cartHash,
    meta_data: (order.metaData as Array<{ key: string; value: unknown }>)?.map((m, i) => ({ ...m, id: i })) ?? [],
    line_items: (options?.lineItems ?? []).map((item, i) => formatLineItemResponse(item, i)),
    tax_lines: (options?.taxLines ?? []).map(formatTaxLineResponse),
    shipping_lines: (options?.shippingLines ?? []).map(formatShippingLineResponse),
    fee_lines: (options?.feeLines ?? []).map(formatFeeLineResponse),
    coupon_lines: (options?.couponLines ?? []).map(formatCouponLineResponse),
    refunds: (options?.refunds ?? []).map(formatRefundResponse),
    currency_symbol: currencySymbol,
    _links: buildLinks(
      `/wp-json/wc/v3/orders/${order.id}`,
      '/wp-json/wc/v3/orders'
    ),
  };
};

export const formatOrderListResponse = (
  orders: Order[]
): OrderResponse[] => orders.map(order => formatOrderResponse(order));
