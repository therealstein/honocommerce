/**
 * API Key Cryptography
 * Secure hashing and verification for WooCommerce-compatible API keys
 * 
 * Security strategy:
 * - Consumer Key: SHA-256 (fast lookup by prefix + hash match)
 * - Consumer Secret: Argon2id (password-grade, resistant to brute force)
 */

import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import logger from './logger';

// ============== TYPES ==============

export interface ApiKeyPair {
  consumerKey: string;  // Full key: ck_test_xxxxx or ck_live_xxxxx
  consumerSecret: string;  // Full secret: cs_xxxxx
}

export interface HashedApiKey {
  keyPrefix: string;    // First 15 chars for identification
  keyHash: string;      // SHA-256 hash of consumer key
  secretHash: string;   // Argon2id hash of consumer secret
}

// ============== CONSTANTS ==============

const KEY_PREFIX_LENGTH = 15;
const KEY_RANDOM_LENGTH = 40;
const SECRET_RANDOM_LENGTH = 40;

// ============== KEY GENERATION ==============

/**
 * Generate a WooCommerce-compatible API key pair
 */
export const generateApiKeyPair = (environment: 'live' | 'test' = 'test'): ApiKeyPair => {
  const keyPrefix = environment === 'live' ? 'ck_live_' : 'ck_test_';
  const secretPrefix = 'cs_';
  
  const keyRandom = randomBytes(KEY_RANDOM_LENGTH)
    .toString('base64url')
    .slice(0, KEY_RANDOM_LENGTH);
  
  const secretRandom = randomBytes(SECRET_RANDOM_LENGTH)
    .toString('base64url')
    .slice(0, SECRET_RANDOM_LENGTH);
  
  return {
    consumerKey: `${keyPrefix}${keyRandom}`,
    consumerSecret: `${secretPrefix}${secretRandom}`,
  };
};

/**
 * Get the prefix of a consumer key (for lookup and display)
 */
export const getKeyPrefix = (consumerKey: string): string => {
  return consumerKey.slice(0, KEY_PREFIX_LENGTH);
};

// ============== HASHING ==============

/**
 * Hash the consumer key using SHA-256 (fast, for lookup)
 */
export const hashConsumerKey = (consumerKey: string): string => {
  return createHash('sha256')
    .update(consumerKey)
    .digest('hex');
};

/**
 * Hash the consumer secret using Argon2id (password-grade)
 */
export const hashConsumerSecret = async (consumerSecret: string): Promise<string> => {
  try {
    return await argon2.hash(consumerSecret, {
      type: argon2.argon2id,
      memoryCost: 65536,    // 64 MB
      timeCost: 3,          // 3 iterations
      parallelism: 4,
      hashLength: 64,
    });
  } catch (error) {
    logger.error('Failed to hash consumer secret', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Failed to hash consumer secret');
  }
};

/**
 * Hash an API key pair for storage
 */
export const hashApiKeyPair = async (
  consumerKey: string,
  consumerSecret: string
): Promise<HashedApiKey> => {
  const [keyHash, secretHash] = await Promise.all([
    Promise.resolve(hashConsumerKey(consumerKey)),
    hashConsumerSecret(consumerSecret),
  ]);
  
  return {
    keyPrefix: getKeyPrefix(consumerKey),
    keyHash,
    secretHash,
  };
};

// ============== VERIFICATION ==============

/**
 * Verify the consumer key hash
 */
export const verifyConsumerKey = (
  consumerKey: string,
  keyHash: string
): boolean => {
  const computedHash = hashConsumerKey(consumerKey);
  return computedHash === keyHash;
};

/**
 * Verify the consumer secret using Argon2id
 */
export const verifyConsumerSecret = async (
  consumerSecret: string,
  secretHash: string
): Promise<boolean> => {
  try {
    return await argon2.verify(secretHash, consumerSecret);
  } catch (error) {
    logger.error('Failed to verify consumer secret', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
};

/**
 * Verify full API key credentials
 */
export const verifyApiKeyCredentials = async (
  consumerKey: string,
  consumerSecret: string,
  storedKeyHash: string,
  storedSecretHash: string
): Promise<{ valid: boolean; reason?: string }> => {
  // Verify consumer key hash
  if (!verifyConsumerKey(consumerKey, storedKeyHash)) {
    return { valid: false, reason: 'Invalid consumer key' };
  }
  
  // Verify consumer secret
  const secretValid = await verifyConsumerSecret(consumerSecret, storedSecretHash);
  if (!secretValid) {
    return { valid: false, reason: 'Invalid consumer secret' };
  }
  
  return { valid: true };
};

// ============== LEGACY MIGRATION ==============

/**
 * Migrate a legacy plaintext API key to hashed format
 * Used for one-time migration of existing keys
 */
export const migrateLegacyApiKey = async (
  plaintextConsumerKey: string,
  plaintextConsumerSecret: string
): Promise<HashedApiKey> => {
  return hashApiKeyPair(plaintextConsumerKey, plaintextConsumerSecret);
};

export default {
  generateApiKeyPair,
  getKeyPrefix,
  hashConsumerKey,
  hashConsumerSecret,
  hashApiKeyPair,
  verifyConsumerKey,
  verifyConsumerSecret,
  verifyApiKeyCredentials,
  migrateLegacyApiKey,
};
