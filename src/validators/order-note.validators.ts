/**
 * Order Notes Validation Schemas
 */

import { z } from 'zod';

export const createOrderNoteSchema = z.object({
  note: z.string().min(1),
  author: z.number().int().optional().default(0),
  date_created: z.string().datetime().optional(),
  date_created_gmt: z.string().datetime().optional(),
  is_customer_note: z.boolean().optional().default(false),
  added_by_user: z.boolean().optional().default(true),
});

export const updateOrderNoteSchema = z.object({
  note: z.string().min(1).optional(),
  is_customer_note: z.boolean().optional(),
});

export const noteListQuerySchema = z.object({
  context: z.enum(['view', 'edit']).optional().default('view'),
  type: z.enum(['any', 'customer', 'internal']).optional().default('any'),
});

export type CreateOrderNoteInput = z.infer<typeof createOrderNoteSchema>;
export type UpdateOrderNoteInput = z.infer<typeof updateOrderNoteSchema>;
export type NoteListQuery = z.infer<typeof noteListQuerySchema>;
