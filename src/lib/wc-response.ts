/**
 * WooCommerce Response Formatter
 * Formats responses to match WooCommerce v3 JSON contract exactly
 */

import { Context } from 'hono';

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
}

/**
 * Set WooCommerce-compatible pagination headers
 */
export const setPaginationHeaders = (
  c: Context,
  meta: PaginationMeta,
  basePath: string
): void => {
  c.header('X-WP-Total', String(meta.total));
  c.header('X-WP-TotalPages', String(meta.totalPages));
  
  const links: string[] = [];
  const baseUrl = new URL(c.req.url).origin + basePath;
  
  // First page
  links.push(`<${baseUrl}?page=1&per_page=${meta.perPage}>; rel="first"`);
  
  // Last page
  links.push(`<${baseUrl}?page=${meta.totalPages}&per_page=${meta.perPage}>; rel="last"`);
  
  // Next page
  if (meta.currentPage < meta.totalPages) {
    links.push(`<${baseUrl}?page=${meta.currentPage + 1}&per_page=${meta.perPage}>; rel="next"`);
  }
  
  // Previous page
  if (meta.currentPage > 1) {
    links.push(`<${baseUrl}?page=${meta.currentPage - 1}&per_page=${meta.perPage}>; rel="prev"`);
  }
  
  c.header('Link', links.join(', '));
};

/**
 * Build _links object for a resource
 */
export const buildLinks = (
  selfHref: string,
  collectionHref: string,
  additionalLinks?: Record<string, string>
): Record<string, Array<{ href: string }>> => {
  const links: Record<string, Array<{ href: string }>> = {
    self: [{ href: selfHref }],
    collection: [{ href: collectionHref }],
  };
  
  if (additionalLinks) {
    for (const [rel, href] of Object.entries(additionalLinks)) {
      links[rel] = [{ href }];
    }
  }
  
  return links;
};

/**
 * Format a date to WooCommerce ISO 8601 format (local time)
 */
export const formatDate = (date: Date | string | null): string | null => {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace(/\.\d{3}Z$/, '');
};

/**
 * Format a date to WooCommerce ISO 8601 format (GMT)
 */
export const formatDateGmt = (date: Date | string | null): string | null => {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace(/\.\d{3}Z$/, '');
};

/**
 * Format a monetary value to WooCommerce string format
 */
export const formatMoney = (value: number | string | null): string => {
  if (value === null || value === undefined) return '0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toFixed(2);
};
