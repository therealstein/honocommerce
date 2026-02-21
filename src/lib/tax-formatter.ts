/**
 * Tax Formatter
 */

import type { TaxRate, TaxClass } from '../db/schema/taxes';
import { buildLinks } from './wc-response';

// ============== TAX RATE ==============

export interface TaxRateResponse {
  id: number;
  country: string;
  state: string;
  postcode: string;
  city: string;
  rate: string;
  name: string;
  priority: number;
  compound: boolean;
  shipping: boolean;
  order: number;
  class: string;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatTaxRateResponse = (rate: TaxRate): TaxRateResponse => ({
  id: rate.id,
  country: rate.country,
  state: rate.state,
  postcode: rate.postcode,
  city: rate.city,
  rate: rate.rate,
  name: rate.name,
  priority: rate.priority,
  compound: rate.compound,
  shipping: rate.shipping,
  order: rate.order,
  class: rate.taxClass,
  _links: buildLinks(
    `/wp-json/wc/v3/taxes/${rate.id}`,
    '/wp-json/wc/v3/taxes'
  ),
});

export const formatTaxRateListResponse = (rates: TaxRate[]): TaxRateResponse[] =>
  rates.map(formatTaxRateResponse);

// ============== TAX CLASS ==============

export interface TaxClassResponse {
  slug: string;
  name: string;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatTaxClassResponse = (taxClass: TaxClass | { slug: string; name: string }): TaxClassResponse => ({
  slug: taxClass.slug,
  name: taxClass.name,
  _links: {
    collection: [{ href: '/wp-json/wc/v3/taxes/classes' }],
  },
});

export const formatTaxClassListResponse = (classes: Array<TaxClass | { slug: string; name: string }>): TaxClassResponse[] =>
  classes.map(formatTaxClassResponse);
