/**
 * Subscriptions Routes
 * All subscription-related endpoints including notes and statuses
 */

import { Hono } from 'hono';
import type { PluginRoutes, PluginRoute } from '../../src/types/plugin.types';
import {
  subscriptionListQuerySchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  batchSubscriptionsSchema,
  createSubscriptionNoteSchema,
  noteListQuerySchema,
} from './validators';
import { subscriptionService } from './service';
import {
  formatSubscriptionResponse,
  formatSubscriptionListResponse,
  formatSubscriptionNoteResponse,
  formatSubscriptionNoteListResponse,
} from './formatter';
import { setPaginationHeaders } from '../../src/lib/wc-response';
import { wcError } from '../../src/lib/wc-error';
import type { Context } from 'hono';

// Error codes
const SUBSCRIPTION_INVALID_ID = 'woocommerce_rest_subscription_invalid_id';
const INVALID_PARAM = 'woocommerce_rest_invalid_param';

/**
 * Create route handlers
 * Returns array of PluginRoute definitions
 */
export const createSubscriptionRoutes = (): PluginRoutes => {
  const handlers: PluginRoute[] = [
    // GET /subscriptions - List all subscriptions
    {
      method: 'GET',
      path: '/',
      handler: async (c: Context) => {
        const query = subscriptionListQuerySchema.parse(c.req.query());
        const result = await subscriptionService.list(query);

        setPaginationHeaders(c, {
          total: result.total,
          totalPages: result.totalPages,
          currentPage: result.page,
          perPage: result.perPage,
        }, '/wp-json/wc/v3/subscriptions');

        return c.json(formatSubscriptionListResponse(result.items));
      },
    },

    // POST /subscriptions - Create a subscription
    {
      method: 'POST',
      path: '/',
      handler: async (c: Context) => {
        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json(wcError(INVALID_PARAM, 'Invalid JSON body.', 400), 400);
        }

        const parseResult = createSubscriptionSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
          return c.json(wcError(INVALID_PARAM, errors, 400), 400);
        }

        const subscription = await subscriptionService.create(parseResult.data);

        // Get related data
        const [lineItems, shippingLines, taxLines, feeLines, couponLines] = await Promise.all([
          subscriptionService.getItems(subscription.id),
          subscriptionService.getShippingLines(subscription.id),
          subscriptionService.getTaxLines(subscription.id),
          subscriptionService.getFeeLines(subscription.id),
          subscriptionService.getCouponLines(subscription.id),
        ]);

        return c.json(
          formatSubscriptionResponse(subscription, {
            lineItems: lineItems as never[],
            shippingLines: shippingLines as never[],
            taxLines: taxLines as never[],
            feeLines: feeLines as never[],
            couponLines: couponLines as never[],
          }),
          201
        );
      },
    },

    // GET /subscriptions/statuses - List subscription statuses
    {
      method: 'GET',
      path: '/statuses',
      handler: async (c: Context) => {
        const statuses = await subscriptionService.getStatuses();
        return c.json(statuses);
      },
    },

    // POST /subscriptions/batch - Batch operations
    {
      method: 'POST',
      path: '/batch',
      handler: async (c: Context) => {
        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json(wcError(INVALID_PARAM, 'Invalid JSON body.', 400), 400);
        }

        const parseResult = batchSubscriptionsSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
          return c.json(wcError(INVALID_PARAM, errors, 400), 400);
        }

        const { create, update, delete: deleteIds } = parseResult.data;

        const result = {
          create: [] as ReturnType<typeof formatSubscriptionResponse>[],
          update: [] as ReturnType<typeof formatSubscriptionResponse>[],
          delete: [] as ReturnType<typeof formatSubscriptionResponse>[],
        };

        // Create subscriptions with all related data
        if (create?.length) {
          for (const input of create) {
            const subscription = await subscriptionService.create(input);
            const [lineItems, shippingLines, taxLines, feeLines, couponLines] = await Promise.all([
              subscriptionService.getItems(subscription.id),
              subscriptionService.getShippingLines(subscription.id),
              subscriptionService.getTaxLines(subscription.id),
              subscriptionService.getFeeLines(subscription.id),
              subscriptionService.getCouponLines(subscription.id),
            ]);
            result.create.push(
              formatSubscriptionResponse(subscription, {
                lineItems: lineItems as never[],
                shippingLines: shippingLines as never[],
                taxLines: taxLines as never[],
                feeLines: feeLines as never[],
                couponLines: couponLines as never[],
              })
            );
          }
        }

        // Update subscriptions with all related data
        if (update?.length) {
          for (const input of update) {
            const subscription = await subscriptionService.update(input.id, input);
            if (subscription) {
              const [lineItems, shippingLines, taxLines, feeLines, couponLines] = await Promise.all([
                subscriptionService.getItems(subscription.id),
                subscriptionService.getShippingLines(subscription.id),
                subscriptionService.getTaxLines(subscription.id),
                subscriptionService.getFeeLines(subscription.id),
                subscriptionService.getCouponLines(subscription.id),
              ]);
              result.update.push(
                formatSubscriptionResponse(subscription, {
                  lineItems: lineItems as never[],
                  shippingLines: shippingLines as never[],
                  taxLines: taxLines as never[],
                  feeLines: feeLines as never[],
                  couponLines: couponLines as never[],
                })
              );
            }
          }
        }

        // Delete subscriptions (no related data needed)
        if (deleteIds?.length) {
          for (const id of deleteIds) {
            const subscription = await subscriptionService.delete(id);
            if (subscription) result.delete.push(formatSubscriptionResponse(subscription));
          }
        }

        return c.json(result);
      },
    },

    // GET /subscriptions/:id - Get a subscription
    {
      method: 'GET',
      path: '/:id',
      handler: async (c: Context) => {
        const id = parseInt(c.req.param('id'), 10);
        if (isNaN(id) || id <= 0) {
          return c.json(wcError(SUBSCRIPTION_INVALID_ID, 'Invalid subscription ID.', 400), 400);
        }

        const subscription = await subscriptionService.get(id);
        if (!subscription) {
          return c.json(wcError(SUBSCRIPTION_INVALID_ID, 'Invalid subscription ID.', 404), 404);
        }

        // Get related data
        const [lineItems, shippingLines, taxLines, feeLines, couponLines] = await Promise.all([
          subscriptionService.getItems(id),
          subscriptionService.getShippingLines(id),
          subscriptionService.getTaxLines(id),
          subscriptionService.getFeeLines(id),
          subscriptionService.getCouponLines(id),
        ]);

        return c.json(
          formatSubscriptionResponse(subscription, {
            lineItems: lineItems as never[],
            shippingLines: shippingLines as never[],
            taxLines: taxLines as never[],
            feeLines: feeLines as never[],
            couponLines: couponLines as never[],
          })
        );
      },
    },

    // PUT /subscriptions/:id - Update a subscription
    {
      method: 'PUT',
      path: '/:id',
      handler: async (c: Context) => {
        const id = parseInt(c.req.param('id'), 10);
        if (isNaN(id) || id <= 0) {
          return c.json(wcError(SUBSCRIPTION_INVALID_ID, 'Invalid subscription ID.', 400), 400);
        }

        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json(wcError(INVALID_PARAM, 'Invalid JSON body.', 400), 400);
        }

        const parseResult = updateSubscriptionSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
          return c.json(wcError(INVALID_PARAM, errors, 400), 400);
        }

        const subscription = await subscriptionService.update(id, parseResult.data);
        if (!subscription) {
          return c.json(wcError(SUBSCRIPTION_INVALID_ID, 'Invalid subscription ID.', 404), 404);
        }

        // Get related data
        const [lineItems, shippingLines, taxLines, feeLines, couponLines] = await Promise.all([
          subscriptionService.getItems(id),
          subscriptionService.getShippingLines(id),
          subscriptionService.getTaxLines(id),
          subscriptionService.getFeeLines(id),
          subscriptionService.getCouponLines(id),
        ]);

        return c.json(
          formatSubscriptionResponse(subscription, {
            lineItems: lineItems as never[],
            shippingLines: shippingLines as never[],
            taxLines: taxLines as never[],
            feeLines: feeLines as never[],
            couponLines: couponLines as never[],
          })
        );
      },
    },

    // DELETE /subscriptions/:id - Delete a subscription
    {
      method: 'DELETE',
      path: '/:id',
      handler: async (c: Context) => {
        const id = parseInt(c.req.param('id'), 10);
        if (isNaN(id) || id <= 0) {
          return c.json(wcError(SUBSCRIPTION_INVALID_ID, 'Invalid subscription ID.', 400), 400);
        }

        const force = c.req.query('force') === 'true';
        const subscription = await subscriptionService.delete(id, force);

        if (!subscription) {
          return c.json(wcError(SUBSCRIPTION_INVALID_ID, 'Invalid subscription ID.', 404), 404);
        }

        return c.json({
          ...formatSubscriptionResponse(subscription),
          message: force ? 'Permanently deleted subscription.' : 'Moved subscription to trash.',
        });
      },
    },

    // GET /subscriptions/:id/notes - List subscription notes
    {
      method: 'GET',
      path: '/:id/notes',
      handler: async (c: Context) => {
        const subscriptionId = parseInt(c.req.param('id'), 10);
        if (isNaN(subscriptionId) || subscriptionId <= 0) {
          return c.json(wcError(SUBSCRIPTION_INVALID_ID, 'Invalid subscription ID.', 400), 400);
        }

        const subscription = await subscriptionService.get(subscriptionId);
        if (!subscription) {
          return c.json(wcError(SUBSCRIPTION_INVALID_ID, 'Invalid subscription ID.', 404), 404);
        }

        const query = noteListQuerySchema.parse(c.req.query());
        const notes = await subscriptionService.listNotes(subscriptionId, query);

        return c.json(formatSubscriptionNoteListResponse(notes, subscriptionId));
      },
    },

    // POST /subscriptions/:id/notes - Create subscription note
    {
      method: 'POST',
      path: '/:id/notes',
      handler: async (c: Context) => {
        const subscriptionId = parseInt(c.req.param('id'), 10);
        if (isNaN(subscriptionId) || subscriptionId <= 0) {
          return c.json(wcError(SUBSCRIPTION_INVALID_ID, 'Invalid subscription ID.', 400), 400);
        }

        const subscription = await subscriptionService.get(subscriptionId);
        if (!subscription) {
          return c.json(wcError(SUBSCRIPTION_INVALID_ID, 'Invalid subscription ID.', 404), 404);
        }

        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json(wcError(INVALID_PARAM, 'Invalid JSON body.', 400), 400);
        }

        const parseResult = createSubscriptionNoteSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
          return c.json(wcError(INVALID_PARAM, errors, 400), 400);
        }

        const note = await subscriptionService.createNote(subscriptionId, parseResult.data);

        return c.json(formatSubscriptionNoteResponse(note, subscriptionId), 201);
      },
    },

    // GET /subscriptions/:id/notes/:note_id - Get subscription note
    {
      method: 'GET',
      path: '/:id/notes/:note_id',
      handler: async (c: Context) => {
        const subscriptionId = parseInt(c.req.param('id'), 10);
        const noteId = parseInt(c.req.param('note_id'), 10);

        if (isNaN(subscriptionId) || subscriptionId <= 0 || isNaN(noteId) || noteId <= 0) {
          return c.json(wcError(INVALID_PARAM, 'Invalid ID.', 400), 400);
        }

        const note = await subscriptionService.getNote(subscriptionId, noteId);
        if (!note) {
          return c.json(wcError(INVALID_PARAM, 'Invalid note ID.', 404), 404);
        }

        return c.json(formatSubscriptionNoteResponse(note, subscriptionId));
      },
    },

    // DELETE /subscriptions/:id/notes/:note_id - Delete subscription note
    {
      method: 'DELETE',
      path: '/:id/notes/:note_id',
      handler: async (c: Context) => {
        const subscriptionId = parseInt(c.req.param('id'), 10);
        const noteId = parseInt(c.req.param('note_id'), 10);

        if (isNaN(subscriptionId) || subscriptionId <= 0 || isNaN(noteId) || noteId <= 0) {
          return c.json(wcError(INVALID_PARAM, 'Invalid ID.', 400), 400);
        }

        // Force is required for deletion
        const force = c.req.query('force') === 'true';
        if (!force) {
          return c.json(wcError(INVALID_PARAM, 'force=true is required to delete a note.', 400), 400);
        }

        const deleted = await subscriptionService.deleteNote(subscriptionId, noteId);
        if (!deleted) {
          return c.json(wcError(INVALID_PARAM, 'Invalid note ID.', 404), 404);
        }

        return c.json({
          id: noteId,
          note: deleted.note,
          date_created: deleted.date_created.toISOString(),
          message: 'Deleted note.',
          _links: {
            self: [{ href: `/wp-json/wc/v3/subscriptions/${subscriptionId}/notes/${noteId}` }],
            collection: [{ href: `/wp-json/wc/v3/subscriptions/${subscriptionId}/notes` }],
          },
        });
      },
    },
  ];

  return {
    basePath: 'subscriptions',
    routes: handlers,
  };
};

export default createSubscriptionRoutes;
