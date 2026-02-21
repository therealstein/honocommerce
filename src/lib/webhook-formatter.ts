/**
 * Webhook Formatter
 */

import type { Webhook } from '../db/schema/webhooks';
import { buildLinks, formatDate, formatDateGmt } from './wc-response';

export interface WebhookResponse {
  id: number;
  name: string;
  status: string;
  topic: string;
  resource: string;
  event: string;
  hooks: string[];
  delivery_url: string;
  secret: string;
  date_created: string | null;
  date_created_gmt: string | null;
  date_modified: string | null;
  date_modified_gmt: string | null;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatWebhookResponse = (webhook: Webhook): WebhookResponse => ({
  id: webhook.id,
  name: webhook.name,
  status: webhook.status,
  topic: webhook.topic,
  resource: webhook.resource,
  event: webhook.event,
  hooks: webhook.hooks as string[],
  delivery_url: webhook.deliveryUrl,
  secret: webhook.secret,
  date_created: formatDate(webhook.dateCreated),
  date_created_gmt: formatDateGmt(webhook.dateCreatedGmt),
  date_modified: formatDate(webhook.dateModified),
  date_modified_gmt: formatDateGmt(webhook.dateModifiedGmt),
  _links: buildLinks(
    `/wp-json/wc/v3/webhooks/${webhook.id}`,
    '/wp-json/wc/v3/webhooks'
  ),
});

export const formatWebhookListResponse = (webhooks: Webhook[]): WebhookResponse[] =>
  webhooks.map(formatWebhookResponse);
