/**
 * Pagination Utilities
 * Cursor-based pagination internals with WooCommerce-compatible headers
 */

import { z } from 'zod';

/**
 * Standard WooCommerce list query parameters
 */
export const listQuerySchema = z.object({
  context: z.enum(['view', 'edit']).optional().default('view'),
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  exclude: z.union([
    z.coerce.number().int(),
    z.array(z.coerce.number().int())
  ]).transform(v => Array.isArray(v) ? v : [v]).optional(),
  include: z.union([
    z.coerce.number().int(),
    z.array(z.coerce.number().int())
  ]).transform(v => Array.isArray(v) ? v : [v]).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  orderby: z.enum(['date', 'id', 'title', 'slug', 'include']).optional().default('date'),
});

export type ListQueryParams = z.infer<typeof listQuerySchema>;

/**
 * Calculate pagination metadata
 */
export const calculatePagination = (
  totalItems: number,
  page: number,
  perPage: number
): {
  offset: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
} => {
  const totalPages = Math.ceil(totalItems / perPage) || 1;
  const offset = (page - 1) * perPage;
  
  return {
    offset,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

/**
 * Build a pagination result
 */
export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export const createPaginationResult = <T>(
  items: T[],
  total: number,
  page: number,
  perPage: number
): PaginationResult<T> => ({
  items,
  total,
  page,
  perPage,
  totalPages: Math.ceil(total / perPage) || 1,
});
