/**
 * Subscription Response Formatter
 * Formats subscription data for WooCommerce-compatible responses
 */

import type {
  Subscription,
  SubscriptionLineItem,
  SubscriptionShippingLine,
  SubscriptionTaxLine,
  SubscriptionFeeLine,
  SubscriptionCouponLine,
  SubscriptionNote,
  SubscriptionResponse,
  SubscriptionNoteResponse,
  SubscriptionBillingAddress,
  SubscriptionShippingAddress,
} from './types';
import { buildLinks, formatDate, formatDateGmt } from '../../src/lib/wc-response';

// Currency symbols map
const currencySymbols: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$',
  CHF: 'Fr', CNY: '¥', INR: '₹', BRL: 'R$', MXN: 'MX$',
};

// Formatter functions for line items
export const formatLineItemResponse = (item: SubscriptionLineItem): SubscriptionLineItem => ({
  id: item.id,
  name: item.name,
  product_id: item.product_id,
  variation_id: item.variation_id,
  quantity: item.quantity,
  tax_class: item.tax_class ?? '',
  subtotal: item.subtotal,
  subtotal_tax: item.subtotal_tax,
  total: item.total,
  total_tax: item.total_tax,
  taxes: item.taxes ?? [],
  meta_data: item.meta_data ?? [],
  sku: item.sku,
  price: item.price,
});

export const formatShippingLineResponse = (line: SubscriptionShippingLine): SubscriptionShippingLine => ({
  id: line.id,
  method_title: line.method_title,
  method_id: line.method_id,
  instance_id: line.instance_id,
  total: line.total,
  total_tax: line.total_tax,
  taxes: line.taxes ?? [],
  meta_data: line.meta_data ?? [],
});

export const formatTaxLineResponse = (line: SubscriptionTaxLine): SubscriptionTaxLine => ({
  id: line.id,
  rate_code: line.rate_code,
  rate_id: line.rate_id,
  label: line.label,
  compound: line.compound,
  tax_total: line.tax_total,
  shipping_tax_total: line.shipping_tax_total,
  rate_percent: line.rate_percent ?? null,
  meta_data: line.meta_data ?? [],
});

export const formatFeeLineResponse = (line: SubscriptionFeeLine): SubscriptionFeeLine => ({
  id: line.id,
  name: line.name,
  tax_class: line.tax_class ?? '',
  tax_status: line.tax_status,
  total: line.total,
  total_tax: line.total_tax,
  taxes: line.taxes ?? [],
  meta_data: line.meta_data ?? [],
});

export const formatCouponLineResponse = (line: SubscriptionCouponLine): SubscriptionCouponLine => ({
  id: line.id,
  code: line.code,
  discount: line.discount,
  discount_tax: line.discount_tax,
  meta_data: line.meta_data ?? [],
});

export const formatSubscriptionNoteResponse = (note: SubscriptionNote, subscriptionId: number): SubscriptionNoteResponse => ({
  id: note.id,
  date_created: formatDate(note.date_created),
  date_created_gmt: formatDateGmt(note.date_created_gmt),
  note: note.note,
  author: note.author,
  is_customer_note: note.is_customer_note,
  added_by_user: note.added_by_user,
  _links: buildLinks(
    `/wp-json/wc/v3/subscriptions/${subscriptionId}/notes/${note.id}`,
    `/wp-json/wc/v3/subscriptions/${subscriptionId}/notes`
  ),
});

export const formatSubscriptionResponse = (
  subscription: Subscription,
  options?: {
    lineItems?: SubscriptionLineItem[];
    shippingLines?: SubscriptionShippingLine[];
    taxLines?: SubscriptionTaxLine[];
    feeLines?: SubscriptionFeeLine[];
    couponLines?: SubscriptionCouponLine[];
  }
): SubscriptionResponse => {
  const currencySymbol = currencySymbols[subscription.currency] ?? subscription.currency;

  const billing = subscription.billing as SubscriptionBillingAddress;
  const shipping = subscription.shipping as SubscriptionShippingAddress;

  return {
    id: subscription.id,
    parent_id: subscription.parent_id,
    number: subscription.number,
    order_key: subscription.order_key,
    created_via: subscription.created_via,
    version: subscription.version,
    status: subscription.status,
    currency: subscription.currency,
    date_created: formatDate(subscription.date_created),
    date_created_gmt: formatDateGmt(subscription.date_created_gmt),
    date_modified: formatDate(subscription.date_modified),
    date_modified_gmt: formatDateGmt(subscription.date_modified_gmt),
    discount_total: subscription.discount_total,
    discount_tax: subscription.discount_tax,
    shipping_total: subscription.shipping_total,
    shipping_tax: subscription.shipping_tax,
    cart_tax: subscription.cart_tax,
    total: subscription.total,
    total_tax: subscription.total_tax,
    prices_include_tax: subscription.prices_include_tax,
    customer_id: subscription.customer_id,
    customer_ip_address: subscription.customer_ip_address,
    customer_user_agent: subscription.customer_user_agent,
    customer_note: subscription.customer_note,
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
    payment_method: subscription.payment_method,
    payment_method_title: subscription.payment_method_title,
    transaction_id: subscription.transaction_id,
    date_paid: formatDate(subscription.date_paid),
    date_paid_gmt: formatDateGmt(subscription.date_paid_gmt),
    date_completed: formatDate(subscription.date_completed),
    date_completed_gmt: formatDateGmt(subscription.date_completed_gmt),
    billing_period: subscription.billing_period,
    billing_interval: subscription.billing_interval,
    start_date_gmt: formatDateGmt(subscription.start_date_gmt),
    trial_end_date_gmt: formatDateGmt(subscription.trial_end_date_gmt),
    next_payment_date_gmt: formatDateGmt(subscription.next_payment_date_gmt),
    last_payment_date_gmt: formatDateGmt(subscription.last_payment_date_gmt),
    cancelled_date_gmt: formatDateGmt(subscription.cancelled_date_gmt),
    end_date_gmt: formatDateGmt(subscription.end_date_gmt),
    payment_retry_date_gmt: formatDateGmt(subscription.payment_retry_date_gmt),
    resubscribed_from: subscription.resubscribed_from,
    resubscribed_subscription: subscription.resubscribed_subscription,
    line_items: (options?.lineItems ?? []).map(formatLineItemResponse),
    tax_lines: (options?.taxLines ?? []).map(formatTaxLineResponse),
    shipping_lines: (options?.shippingLines ?? []).map(formatShippingLineResponse),
    fee_lines: (options?.feeLines ?? []).map(formatFeeLineResponse),
    coupon_lines: (options?.couponLines ?? []).map(formatCouponLineResponse),
    meta_data: (subscription.meta_data as Array<{ key: string; value: unknown }>)?.map((m, i) => ({ ...m, id: i })) ?? [],
    currency_symbol: currencySymbol,
    _links: buildLinks(
      `/wp-json/wc/v3/subscriptions/${subscription.id}`,
      '/wp-json/wc/v3/subscriptions'
    ),
  };
};

export const formatSubscriptionListResponse = (
  subscriptions: Subscription[]
): SubscriptionResponse[] => subscriptions.map(subscription => formatSubscriptionResponse(subscription));

export const formatSubscriptionNoteListResponse = (
  notes: SubscriptionNote[],
  subscriptionId: number
): SubscriptionNoteResponse[] => notes.map(note => formatSubscriptionNoteResponse(note, subscriptionId));
