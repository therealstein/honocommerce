/**
 * Tag Response Formatter
 */

import type { Tag } from '../db/schema/product-tags';
import { buildLinks } from './wc-response';

export interface TagResponse {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatTagResponse = (tag: Tag): TagResponse => ({
  id: tag.id,
  name: tag.name,
  slug: tag.slug,
  description: tag.description ?? '',
  count: tag.count,
  _links: buildLinks(
    `/wp-json/wc/v3/products/tags/${tag.id}`,
    '/wp-json/wc/v3/products/tags'
  ),
});

export const formatTagListResponse = (tags: Tag[]): TagResponse[] =>
  tags.map(formatTagResponse);
