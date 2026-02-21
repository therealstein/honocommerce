/**
 * Order Notes Service
 * Business logic for order notes operations
 */

import { db } from '../db';
import { orderNotes, type OrderNote, type NewOrderNote } from '../db/schema/orders';
import { orders } from '../db/schema/orders';
import { eq, and, desc } from 'drizzle-orm';

/**
 * List all notes for an order
 */
export const listOrderNotes = async (
  orderId: number,
  type: 'any' | 'customer' | 'internal' = 'any'
): Promise<OrderNote[]> => {
  const conditions = [eq(orderNotes.orderId, orderId)];
  
  if (type === 'customer') {
    conditions.push(eq(orderNotes.isCustomerNote, true));
  } else if (type === 'internal') {
    conditions.push(eq(orderNotes.isCustomerNote, false));
  }
  
  return db
    .select()
    .from(orderNotes)
    .where(and(...conditions))
    .orderBy(desc(orderNotes.dateCreated));
};

/**
 * Get a single order note
 */
export const getOrderNote = async (
  orderId: number,
  noteId: number
): Promise<OrderNote | null> => {
  const [note] = await db
    .select()
    .from(orderNotes)
    .where(and(eq(orderNotes.id, noteId), eq(orderNotes.orderId, orderId)))
    .limit(1);
  
  return note ?? null;
};

/**
 * Create a new order note
 */
export const createOrderNote = async (
  orderId: number,
  input: {
    note: string;
    author?: number;
    is_customer_note?: boolean;
    added_by_user?: boolean;
  }
): Promise<OrderNote> => {
  const now = new Date();
  
  const newNote: NewOrderNote = {
    orderId,
    note: input.note,
    author: input.author ?? 0,
    dateCreated: now,
    dateCreatedGmt: now,
    isCustomerNote: input.is_customer_note ?? false,
    addedByUser: input.added_by_user ?? true,
    isSystem: false,
  };
  
  const [note] = await db.insert(orderNotes).values(newNote).returning();
  
  // Update order modified date
  await db
    .update(orders)
    .set({ dateModified: now, dateModifiedGmt: now })
    .where(eq(orders.id, orderId));
  
  return note;
};

/**
 * Create a system note (auto-generated)
 */
export const createSystemNote = async (
  orderId: number,
  note: string
): Promise<OrderNote> => {
  const now = new Date();
  
  const newNote: NewOrderNote = {
    orderId,
    note,
    author: 0,
    dateCreated: now,
    dateCreatedGmt: now,
    isCustomerNote: false,
    addedByUser: false,
    isSystem: true,
  };
  
  const [createdNote] = await db.insert(orderNotes).values(newNote).returning();
  
  return createdNote;
};

/**
 * Delete an order note
 */
export const deleteOrderNote = async (
  orderId: number,
  noteId: number
): Promise<OrderNote | null> => {
  const [deleted] = await db
    .delete(orderNotes)
    .where(and(eq(orderNotes.id, noteId), eq(orderNotes.orderId, orderId)))
    .returning();
  
  return deleted ?? null;
};

export const orderNoteService = {
  list: listOrderNotes,
  get: getOrderNote,
  create: createOrderNote,
  createSystem: createSystemNote,
  delete: deleteOrderNote,
};

export default orderNoteService;
