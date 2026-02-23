/**
 * Admin API Key Routes
 * Management endpoints for WooCommerce-compatible API keys
 * 
 * These routes are protected by better-auth admin middleware
 * NOT part of WooCommerce REST API spec - internal management only
 * 
 * SECURITY: Keys are stored as hashes, never plaintext!
 */

import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db";
import { apiKeys } from "../../db/schema/api-keys";
import { eq, desc } from "drizzle-orm";
import logger from "../../lib/logger";
import { generateApiKeyPair, hashApiKeyPair, verifyApiKeyCredentials } from "../../lib/api-key-crypto";

const router = new Hono();

// ============== VALIDATION SCHEMAS ==============

const createApiKeySchema = z.object({
  description: z.string().min(1).max(255),
  permissions: z.enum(["read", "write", "read_write"]).default("read_write"),
  environment: z.enum(["live", "test"]).default("test"),
  rate_limit: z.number().min(100).max(100000).optional(),
});

const updateApiKeySchema = z.object({
  description: z.string().min(1).max(255).optional(),
  permissions: z.enum(["read", "write", "read_write"]).optional(),
  rate_limit: z.number().min(100).max(100000).optional(),
});

// ============== ROUTES ==============

/**
 * GET /admin/api-keys
 * List all API keys (masked)
 */
router.get("/", async (c) => {
  try {
    const keys = await db
      .select({
        id: apiKeys.id,
        key_prefix: apiKeys.keyPrefix,
        description: apiKeys.description,
        permissions: apiKeys.permissions,
        rate_limit: apiKeys.rateLimit,
        last_access: apiKeys.lastAccess,
        created_at: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.isDeleted, false))
      .orderBy(desc(apiKeys.createdAt));

    return c.json({
      api_keys: keys,
      total: keys.length,
    });
  } catch (error) {
    logger.error("Failed to list API keys", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      { code: "internal_error", message: "Failed to list API keys", data: { status: 500 } },
      500
    );
  }
});

/**
 * POST /admin/api-keys
 * Create a new API key (WooCommerce-compatible format)
 * 
 * Returns the full key and secret ONLY on creation!
 * Keys are stored as hashes in the database.
 */
router.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createApiKeySchema.parse(body);

    // Get current admin user from context
    const session = c.get("session");
    const userId = session?.user?.id ? parseInt(session.user.id, 10) || 1 : 1;

    // Generate WooCommerce-compatible API key pair
    const { consumerKey, consumerSecret } = generateApiKeyPair(parsed.environment);

    // Hash the keys for secure storage
    const hashedKeys = await hashApiKeyPair(consumerKey, consumerSecret);

    // Insert into database (only hashed values!)
    const [newKey] = await db
      .insert(apiKeys)
      .values({
        keyPrefix: hashedKeys.keyPrefix,
        keyHash: hashedKeys.keyHash,
        secretHash: hashedKeys.secretHash,
        description: parsed.description,
        userId,
        permissions: parsed.permissions,
        rateLimit: parsed.rate_limit || 1000,
        lastAccess: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      })
      .returning();

    logger.info("API key created", {
      keyId: newKey.id,
      keyPrefix: hashedKeys.keyPrefix,
      description: parsed.description,
      permissions: parsed.permissions,
    });

    // Return in WooCommerce format - FULL KEY ONLY SHOWN ONCE!
    return c.json(
      {
        id: newKey.id,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        key_prefix: hashedKeys.keyPrefix + "...",
        description: newKey.description,
        permissions: newKey.permissions,
        rate_limit: newKey.rateLimit,
        created_at: newKey.createdAt?.toISOString(),
        _warning: "🔒 Store these credentials securely! They will NEVER be shown again. The secret is stored as a hash and cannot be recovered.",
      },
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { code: "invalid_params", message: error.errors[0].message, data: { status: 400 } },
        400
      );
    }
    logger.error("Failed to create API key", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      { code: "internal_error", message: "Failed to create API key", data: { status: 500 } },
      500
    );
  }
});

/**
 * GET /admin/api-keys/:id
 * Get a single API key (masked)
 */
router.get("/:id", async (c) => {
  try {
    const keyId = parseInt(c.req.param("id"), 10);

    if (isNaN(keyId)) {
      return c.json(
        { code: "invalid_id", message: "Invalid API key ID", data: { status: 400 } },
        400
      );
    }

    const [key] = await db
      .select({
        id: apiKeys.id,
        key_prefix: apiKeys.keyPrefix,
        description: apiKeys.description,
        permissions: apiKeys.permissions,
        rate_limit: apiKeys.rateLimit,
        last_access: apiKeys.lastAccess,
        created_at: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (!key || key.key_prefix === null) {
      return c.json(
        { code: "not_found", message: "API key not found", data: { status: 404 } },
        404
      );
    }

    return c.json(key);
  } catch (error) {
    logger.error("Failed to get API key", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      { code: "internal_error", message: "Failed to get API key", data: { status: 500 } },
      500
    );
  }
});

/**
 * PUT /admin/api-keys/:id
 * Update an API key (description, permissions, rate limit only)
 */
router.put("/:id", async (c) => {
  try {
    const keyId = parseInt(c.req.param("id"), 10);

    if (isNaN(keyId)) {
      return c.json(
        { code: "invalid_id", message: "Invalid API key ID", data: { status: 400 } },
        400
      );
    }

    const body = await c.req.json();
    const parsed = updateApiKeySchema.parse(body);

    const [updatedKey] = await db
      .update(apiKeys)
      .set({
        description: parsed.description,
        permissions: parsed.permissions,
        rateLimit: parsed.rate_limit,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId))
      .returning();

    if (!updatedKey) {
      return c.json(
        { code: "not_found", message: "API key not found", data: { status: 404 } },
        404
      );
    }

    logger.info("API key updated", { keyId });

    return c.json({
      id: updatedKey.id,
      description: updatedKey.description,
      permissions: updatedKey.permissions,
      rate_limit: updatedKey.rateLimit,
      updated_at: updatedKey.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { code: "invalid_params", message: error.errors[0].message, data: { status: 400 } },
        400
      );
    }
    logger.error("Failed to update API key", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      { code: "internal_error", message: "Failed to update API key", data: { status: 500 } },
      500
    );
  }
});

/**
 * POST /admin/api-keys/:id/regenerate
 * Regenerate an API key (creates new credentials, old key is revoked)
 */
router.post("/:id/regenerate", async (c) => {
  try {
    const keyId = parseInt(c.req.param("id"), 10);

    if (isNaN(keyId)) {
      return c.json(
        { code: "invalid_id", message: "Invalid API key ID", data: { status: 400 } },
        400
      );
    }

    // Get the old key
    const [oldKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (!oldKey || oldKey.isDeleted) {
      return c.json(
        { code: "not_found", message: "API key not found", data: { status: 404 } },
        404
      );
    }

    // Determine environment from old key prefix
    const environment = oldKey.keyPrefix?.startsWith("ck_live") ? "live" : "test";

    // Generate new key pair
    const { consumerKey, consumerSecret } = generateApiKeyPair(environment);

    // Hash the new keys
    const hashedKeys = await hashApiKeyPair(consumerKey, consumerSecret);

    // Update the existing key with new hashed credentials
    const [updatedKey] = await db
      .update(apiKeys)
      .set({
        keyPrefix: hashedKeys.keyPrefix,
        keyHash: hashedKeys.keyHash,
        secretHash: hashedKeys.secretHash,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId))
      .returning();

    logger.info("API key regenerated", { keyId });

    return c.json({
      id: updatedKey.id,
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      key_prefix: hashedKeys.keyPrefix + "...",
      description: updatedKey.description,
      permissions: updatedKey.permissions,
      created_at: new Date().toISOString(),
      _warning: "🔒 Store these new credentials securely! The old key is now permanently revoked.",
    });
  } catch (error) {
    logger.error("Failed to regenerate API key", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      { code: "internal_error", message: "Failed to regenerate API key", data: { status: 500 } },
      500
    );
  }
});

/**
 * DELETE /admin/api-keys/:id
 * Revoke/delete an API key (soft delete)
 */
router.delete("/:id", async (c) => {
  try {
    const keyId = parseInt(c.req.param("id"), 10);

    if (isNaN(keyId)) {
      return c.json(
        { code: "invalid_id", message: "Invalid API key ID", data: { status: 400 } },
        400
      );
    }

    // Soft delete
    const [deletedKey] = await db
      .update(apiKeys)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId))
      .returning();

    if (!deletedKey) {
      return c.json(
        { code: "not_found", message: "API key not found", data: { status: 404 } },
        404
      );
    }

    logger.info("API key revoked", { keyId });

    return c.json({
      id: keyId,
      status: "revoked",
      revoked_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to revoke API key", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      { code: "internal_error", message: "Failed to revoke API key", data: { status: 500 } },
      500
    );
  }
});

export default router;
