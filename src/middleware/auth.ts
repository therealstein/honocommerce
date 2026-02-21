/**
 * Auth Middleware
 * Consumer key/secret verification (WooCommerce compatible)
 */

import { Context, Next } from 'hono';
import { wcError, WcErrorCodes } from '../lib/wc-error';
import { db } from '../db';
import { apiKeys } from '../db/schema/api-keys';
import { eq, and } from 'drizzle-orm';

declare module 'hono' {
  interface ContextVariableMap {
    apiKey: typeof apiKeys.$inferSelect;
  }
}

/**
 * Decode Basic Auth header
 */
const decodeBasicAuth = (authHeader: string): [string, string] | null => {
  if (!authHeader.startsWith('Basic ')) return null;
  
  try {
    const decoded = atob(authHeader.slice(6));
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) return null;
    
    return [decoded.slice(0, colonIndex), decoded.slice(colonIndex + 1)];
  } catch {
    return null;
  }
};

/**
 * WooCommerce-compatible authentication middleware
 * Supports HTTP Basic Auth with consumer_key:consumer_secret
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const authorization = c.req.header('Authorization');
  
  if (!authorization) {
    return c.json(
      wcError(WcErrorCodes.CANNOT_VIEW, 'Sorry, you cannot list resources.', 401),
      401
    );
  }
  
  const credentials = decodeBasicAuth(authorization);
  
  if (!credentials) {
    return c.json(
      wcError(WcErrorCodes.CANNOT_VIEW, 'Sorry, you cannot list resources.', 401),
      401
    );
  }
  
  const [consumerKey, consumerSecret] = credentials;
  
  // Validate key format (ck_ and cs_ prefixes)
  if (!consumerKey.startsWith('ck_') || !consumerSecret.startsWith('cs_')) {
    return c.json(
      wcError(WcErrorCodes.CANNOT_VIEW, 'Sorry, you cannot list resources.', 401),
      401
    );
  }
  
  // Look up API key in database
  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.consumerKey, consumerKey),
        eq(apiKeys.consumerSecret, consumerSecret)
      )
    )
    .limit(1);
  
  if (!apiKey) {
    return c.json(
      wcError(WcErrorCodes.CANNOT_VIEW, 'Sorry, you cannot list resources.', 401),
      401
    );
  }
  
  // Store API key in context for use in routes
  c.set('apiKey', apiKey);
  
  await next();
};
