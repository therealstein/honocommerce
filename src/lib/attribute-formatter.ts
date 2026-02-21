/**
 * Attribute Response Formatter
 */

import type { Attribute, AttributeTerm } from '../db/schema/product-attributes';
import { buildLinks, formatDate, formatDateGmt } from './wc-response';

export interface AttributeResponse {
  id: number;
  name: string;
  slug: string;
  type: string;
  order_by: string;
  has_archives: boolean;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatAttributeResponse = (attribute: Attribute): AttributeResponse => ({
  id: attribute.id,
  name: attribute.name,
  slug: attribute.slug,
  type: attribute.type,
  order_by: attribute.orderBy,
  has_archives: attribute.hasArchives,
  _links: buildLinks(
    `/wp-json/wc/v3/products/attributes/${attribute.id}`,
    '/wp-json/wc/v3/products/attributes'
  ),
});

export const formatAttributeListResponse = (attributes: Attribute[]): AttributeResponse[] =>
  attributes.map(formatAttributeResponse);

export interface AttributeTermResponse {
  id: number;
  name: string;
  slug: string;
  description: string;
  menu_order: number;
  count: number;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatAttributeTermResponse = (
  term: AttributeTerm,
  attributeId: number
): AttributeTermResponse => ({
  id: term.id,
  name: term.name,
  slug: term.slug,
  description: term.description ?? '',
  menu_order: term.menuOrder,
  count: term.count,
  _links: buildLinks(
    `/wp-json/wc/v3/products/attributes/${attributeId}/terms/${term.id}`,
    `/wp-json/wc/v3/products/attributes/${attributeId}/terms`
  ),
});

export const formatAttributeTermListResponse = (
  terms: AttributeTerm[],
  attributeId: number
): AttributeTermResponse[] =>
  terms.map(term => formatAttributeTermResponse(term, attributeId));
