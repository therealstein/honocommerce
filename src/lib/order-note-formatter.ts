/**
 * Order Note Formatter
 */

import type { OrderNote } from '../db/schema/orders';
import { formatDate, formatDateGmt } from './wc-response';

export interface OrderNoteResponse {
  id: number;
  date_created: string | null;
  date_created_gmt: string | null;
  note: string;
  author: string;
  is_customer_note: boolean;
  added_by_user: boolean;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatOrderNoteResponse = (
  note: OrderNote,
  orderId: number
): OrderNoteResponse => ({
  id: note.id,
  date_created: formatDate(note.dateCreated),
  date_created_gmt: formatDateGmt(note.dateCreatedGmt),
  note: note.note,
  author: note.author === 0 ? 'system' : `user:${note.author}`,
  is_customer_note: note.isCustomerNote,
  added_by_user: note.addedByUser,
  _links: {
    self: [{ href: `/wp-json/wc/v3/orders/${orderId}/notes/${note.id}` }],
    collection: [{ href: `/wp-json/wc/v3/orders/${orderId}/notes` }],
    up: [{ href: `/wp-json/wc/v3/orders/${orderId}` }],
  },
});

export const formatOrderNoteListResponse = (
  notes: OrderNote[],
  orderId: number
): OrderNoteResponse[] =>
  notes.map(note => formatOrderNoteResponse(note, orderId));
