/**
 * Category Response Formatter
 */

import type { Category } from '../db/schema/product-categories';
import { buildLinks, formatDate, formatDateGmt } from './wc-response';

export interface CategoryResponse {
  id: number;
  name: string;
  slug: string;
  parent: number;
  description: string;
  display: string;
  image: {
    id: number;
    src: string;
    name: string;
    alt: string;
  } | null;
  menu_order: number;
  count: number;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatCategoryResponse = (category: Category): CategoryResponse => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  parent: category.parentId,
  description: category.description ?? '',
  display: category.display,
  image: category.image as CategoryResponse['image'],
  menu_order: category.menuOrder,
  count: category.count,
  _links: buildLinks(
    `/wp-json/wc/v3/products/categories/${category.id}`,
    '/wp-json/wc/v3/products/categories'
  ),
});

export const formatCategoryListResponse = (categories: Category[]): CategoryResponse[] =>
  categories.map(formatCategoryResponse);
