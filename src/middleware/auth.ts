/**
 * Auth Middleware
 * Consumer key/secret verification (WooCommerce compatible)
 * 
 * Supports two authentication methods:
 * 1. Hashed API keys (NEW) - Secure storage with SHA-256 + Argon2id
 * 2. Legacy plaintext keys (DEPRECATED) - For migration compatibility
 */

import { Context, Next } from 'hono';
import { wcError, WcErrorCodes } from '../lib/wc-error';
import { db } from '../db';
import { apiKeys } from '../db/schema/api-keys';
import { eq, and } from 'drizzle-orm';
import { authApi } from '../lib/auth';
import { getKeyPrefix, verifyApiKeyCredentials, hashConsumerKey, hashConsumerSecret } from '../lib/api-key-crypto';
import logger from '../lib/logger';

declare module 'hono' {
  interface ContextVariableMap {
    apiKey: typeof apiKeys.$inferSelect;
    apiKeyId: string;
    apiKeyPermissions: string;
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
 * Verify hashed API key (NEW secure method)
 * Uses key prefix for lookup, then verifies hashes
 */
const verifyHashedApiKey = async (
  consumerKey: string,
  consumerSecret: string
): Promise<{ valid: boolean; apiKey?: typeof apiKeys.$inferSelect; reason?: string }> => {
  try {
    // Get key prefix for lookup
    const keyPrefix = getKeyPrefix(consumerKey);
    
    // Look up by prefix
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyPrefix, keyPrefix),
          eq(apiKeys.isDeleted, false)
        )
      )
      .limit(1);
    
    if (!apiKey || !apiKey.keyHash || !apiKey.secretHash) {
      return { valid: false, reason: 'API key not found' };
    }
    
    // Verify both key and secret hashes
    const result = await verifyApiKeyCredentials(
      consumerKey,
      consumerSecret,
      apiKey.keyHash,
      apiKey.secretHash
    );
    
    if (!result.valid) {
      return { valid: false, reason: result.reason };
    }
    
    // Update last access time (async, don't wait)
    db.update(apiKeys)
      .set({ lastAccess: new Date() })
      .where(eq(apiKeys.id, apiKey.id))
      .execute()
      .catch((err) => {
        logger.error('Failed to update last access', { error: err.message });
      });
    
    return { valid: true, apiKey };
  } catch (error) {
    logger.error('Hashed API key verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { valid: false, reason: 'Verification error' };
  }
};

/**
 * Verify legacy plaintext API key (DEPRECATED - for migration only)
 * This will be removed after all keys are migrated
 */
const verifyLegacyApiKey = async (
  consumerKey: string,
  consumerSecret: string
): Promise<{ valid: boolean; apiKey?: typeof apiKeys.$inferSelect }> => {
  try {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.consumerKey, consumerKey),
          eq(apiKeys.consumerSecret, consumerSecret),
          eq(apiKeys.isDeleted, false)
        )
      )
      .limit(1);
    
    if (apiKey) {
      logger.warn('Legacy plaintext API key used - consider migrating', {
        keyId: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
      });
      
      // Update last access time (async, don't wait)
      db.update(apiKeys)
        .set({ lastAccess: new Date() })
        .where(eq(apiKeys.id, apiKey.id))
        .execute()
        .catch((err) => {
          logger.error('Failed to update last access', { error: err.message });
        });
      
      return { valid: true, apiKey };
    }
    
    return { valid: false };
  } catch (error) {
    logger.error('Legacy API key verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { valid: false };
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
  
  // Validate key format (must start with ck_)
  if (!consumerKey.startsWith('ck_')) {
    return c.json(
      wcError(WcErrorCodes.CANNOT_VIEW, 'Sorry, you cannot list resources.', 401),
      401
    );
  }
  
  // Validate secret format (must start with cs_)
  if (!consumerSecret.startsWith('cs_')) {
    return c.json(
      wcError(WcErrorCodes.CANNOT_VIEW, 'Sorry, you cannot list resources.', 401),
      401
    );
  }
  
  // Try hashed verification first (NEW secure method)
  const hashedResult = await verifyHashedApiKey(consumerKey, consumerSecret);
  
  if (hashedResult.valid && hashedResult.apiKey) {
    c.set('apiKey', hashedResult.apiKey);
    c.set('apiKeyId', String(hashedResult.apiKey.id));
    c.set('apiKeyPermissions', hashedResult.apiKey.permissions);
    await next();
    return;
  }
  
  // Fallback to legacy plaintext verification (DEPRECATED)
  const legacyResult = await verifyLegacyApiKey(consumerKey, consumerSecret);
  
  if (legacyResult.valid && legacyResult.apiKey) {
    c.set('apiKey', legacyResult.apiKey);
    c.set('apiKeyId', String(legacyResult.apiKey.id));
    c.set('apiKeyPermissions', legacyResult.apiKey.permissions);
    await next();
    return;
  }
  
  // Both methods failed - invalid credentials
  return c.json(
    wcError(WcErrorCodes.CANNOT_VIEW, 'Sorry, you cannot list resources.', 401),
    401
  );
};
