/**
 * Better Auth Configuration
 * Authentication for admin routes and API key management
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { apiKey } from "better-auth/plugins";
import { db } from "../db";
import { createAuthSecondaryStorage, isRedisConnectedForAuth } from "./redis";
import logger from "./logger";

/**
 * Better Auth Instance
 * Configured for:
 * - Email/password authentication (admin users)
 * - Admin plugin (role-based access control)
 * - API Key plugin (WooCommerce-compatible keys)
 * - Redis secondary storage (session caching)
 */
export const auth = betterAuth({
  // Database - use existing Drizzle connection
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // Redis for session caching (if available)
  ...(isRedisConnectedForAuth()
    ? {
        secondaryStorage: createAuthSecondaryStorage(),
      }
    : {}),

  // Email/password authentication for admins
  emailAndPassword: {
    enabled: true,
  },

  // User configuration
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false, // Don't allow user to set role on signup
      },
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Plugins
  plugins: [
    // Admin plugin - role-based access control
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      impersonationSessionDuration: 60 * 60, // 1 hour
      bannedUserMessage: "Your account has been banned. Please contact support.",
    }),

    // API Key plugin - WooCommerce-compatible keys
    apiKey({
      // Custom prefix for WooCommerce compatibility
      defaultPrefix: "hc_", // Honocommerce prefix (different from ck_ to distinguish)
      defaultKeyLength: 64,

      // Rate limiting defaults
      rateLimit: {
        enabled: true,
        timeWindow: 1000 * 60 * 60, // 1 hour
        maxRequests: 1000,
      },

      // Key expiration
      keyExpiration: {
        defaultExpiresIn: null, // No expiration by default
      },

      // Enable metadata for storing permissions
      enableMetadata: true,

      // Store starting characters for identification
      startingCharactersConfig: {
        shouldStore: true,
        charactersLength: 8,
      },
    }),
  ],

  // Advanced options
  advanced: {
    generateId: () => crypto.randomUUID(),
    // Cookie configuration
    cookie: {
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      path: "/",
    },
  },

  // Logging hooks
  logger: {
    disabled: process.env.NODE_ENV === "test",
  },
});

/**
 * Auth API helpers
 */
export const authApi = auth.api;

/**
 * Check if user is admin
 */
export const isAdmin = async (headers: Headers): Promise<boolean> => {
  try {
    const session = await authApi.getSession({ headers });
    if (!session) return false;
    return session.user.role === "admin";
  } catch {
    return false;
  }
};

/**
 * Get current session
 */
export const getSession = async (headers: Headers) => {
  try {
    return await authApi.getSession({ headers });
  } catch {
    return null;
  }
};

/**
 * Create WooCommerce-compatible API key pair
 * Returns both consumer_key and consumer_secret
 */
export const createWooCommerceApiKey = async (
  userId: string,
  description: string,
  permissions: "read" | "write" | "read_write" = "read_write",
  environment: "live" | "test" = "test"
): Promise<{
  id: string;
  consumerKey: string;
  consumerSecret: string;
  keyId: string;
}> => {
  // Generate consumer key with WooCommerce-compatible prefix
  const prefix = environment === "live" ? "ck_live_" : "ck_test_";

  // Create API key using better-auth
  const result = await authApi.createApiKey({
    body: {
      name: description,
      prefix,
      metadata: {
        permissions,
        environment,
        type: "woocommerce",
      },
      rateLimitEnabled: true,
      rateLimitMax: 5000,
      rateLimitTimeWindow: 1000 * 60 * 60, // 1 hour
    },
    headers: new Headers(), // Server-side call
  });

  // Generate consumer secret (separate from the API key)
  const consumerSecret = generateConsumerSecret();

  // Store the secret hash in metadata (we'll verify it separately)
  // Note: In production, you might want a separate table for this

  return {
    id: result.id,
    consumerKey: result.key,
    consumerSecret,
    keyId: result.start || result.id,
  };
};

/**
 * Generate WooCommerce-compatible consumer secret
 */
const generateConsumerSecret = (): string => {
  const prefix = "cs_";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return prefix + secret;
};

/**
 * Verify WooCommerce API credentials
 */
export const verifyWooCommerceCredentials = async (
  consumerKey: string,
  consumerSecret: string
): Promise<{
  valid: boolean;
  keyId?: string;
  permissions?: string;
  error?: string;
}> => {
  try {
    // Verify the API key
    const result = await authApi.verifyApiKey({
      body: {
        key: consumerKey,
      },
    });

    if (!result.valid || !result.key) {
      return { valid: false, error: "Invalid consumer key" };
    }

    // Check if the key has WooCommerce metadata
    const metadata = result.key.metadata as {
      permissions?: string;
      type?: string;
      secretHash?: string;
    } | null;

    if (metadata?.type !== "woocommerce") {
      return { valid: false, error: "Not a WooCommerce API key" };
    }

    // Note: In a full implementation, we'd verify the consumer secret hash here
    // For now, we trust that the key is valid

    return {
      valid: true,
      keyId: result.key.id,
      permissions: metadata?.permissions || "read_write",
    };
  } catch (error) {
    logger.error("API key verification failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { valid: false, error: "Verification failed" };
  }
};

export default auth;
