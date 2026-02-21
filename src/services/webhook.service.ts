/**
 * Webhook Service
 * Business logic for webhook operations
 */

import { db } from '../db';
import { webhooks, type Webhook, type NewWebhook } from '../db/schema/webhooks';
import { eq, and, desc, asc, sql, like } from 'drizzle-orm';
import type { ListQueryParams, PaginationResult } from '../lib/pagination';
import { createPaginationResult } from '../lib/pagination';

export interface CreateWebhookInput {
  name: string;
  topic: string;
  delivery_url: string;
  secret?: string;
  status?: 'active' | 'paused' | 'disabled';
}

export interface UpdateWebhookInput extends Partial<CreateWebhookInput> {}

/**
 * Parse topic into resource and event
 */
const parseTopic = (topic: string): { resource: string; event: string } => {
  const [resource, event] = topic.split('.');
  return { resource, event };
};

/**
 * Generate a random secret
 */
const generateSecret = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * List webhooks with pagination
 */
export const listWebhooks = async (
  params: ListQueryParams
): Promise<PaginationResult<Webhook>> => {
  const { page, per_page, order, orderby, search } = params;
  
  const offset = (page - 1) * per_page;
  
  const conditions = [eq(webhooks.isDeleted, false)];
  
  if (search) {
    conditions.push(like(webhooks.name, `%${search}%`));
  }
  
  const orderColumn = orderby === 'id' ? webhooks.id 
    : webhooks.dateCreated;
  
  const orderFn = order === 'asc' ? asc : desc;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(webhooks)
    .where(and(...conditions));
  
  const total = Number(count);
  
  const items = await db
    .select()
    .from(webhooks)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(per_page)
    .offset(offset);
  
  return createPaginationResult(items, total, page, per_page);
};

/**
 * Get a single webhook by ID
 */
export const getWebhook = async (id: number): Promise<Webhook | null> => {
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.isDeleted, false)))
    .limit(1);
  
  return webhook ?? null;
};

/**
 * Create a new webhook
 */
export const createWebhook = async (input: CreateWebhookInput): Promise<Webhook> => {
  const { resource, event } = parseTopic(input.topic);
  const now = new Date();
  
  const newWebhook: NewWebhook = {
    name: input.name,
    status: input.status ?? 'active',
    topic: input.topic,
    resource,
    event,
    hooks: [],
    deliveryUrl: input.delivery_url,
    secret: input.secret ?? generateSecret(),
    pendingDelivery: false,
    apiKeyId: null,
    dateCreated: now,
    dateCreatedGmt: now,
    dateModified: now,
    dateModifiedGmt: now,
  };
  
  const [webhook] = await db.insert(webhooks).values(newWebhook).returning();
  
  return webhook;
};

/**
 * Update a webhook
 */
export const updateWebhook = async (
  id: number,
  input: UpdateWebhookInput
): Promise<Webhook | null> => {
  const updateData: Partial<NewWebhook> = {
    dateModified: new Date(),
    dateModifiedGmt: new Date(),
  };
  
  if (input.name) updateData.name = input.name;
  if (input.status) updateData.status = input.status;
  if (input.topic) {
    const { resource, event } = parseTopic(input.topic);
    updateData.topic = input.topic;
    updateData.resource = resource;
    updateData.event = event;
  }
  if (input.delivery_url) updateData.deliveryUrl = input.delivery_url;
  if (input.secret) updateData.secret = input.secret;
  
  const [webhook] = await db
    .update(webhooks)
    .set(updateData)
    .where(and(eq(webhooks.id, id), eq(webhooks.isDeleted, false)))
    .returning();
  
  return webhook ?? null;
};

/**
 * Delete a webhook
 */
export const deleteWebhook = async (id: number): Promise<boolean> => {
  const result = await db
    .update(webhooks)
    .set({ isDeleted: true })
    .where(eq(webhooks.id, id));
  
  return result.rowCount !== null && result.rowCount > 0;
};

export const webhookService = {
  list: listWebhooks,
  get: getWebhook,
  create: createWebhook,
  update: updateWebhook,
  delete: deleteWebhook,
};

export default webhookService;
