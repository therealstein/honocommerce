/**
 * Redis Client for Better Auth Secondary Storage
 * Shared Redis connection for session caching
 */

import IORedis from 'ioredis';
import logger from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: IORedis | null = null;
let isConnected = false;

/**
 * Get or create Redis client
 */
export const getRedisClient = (): IORedis | null => {
  if (redisClient && isConnected) {
    return redisClient;
  }

  try {
    redisClient = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('Redis client connected for auth');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
      isConnected = false;
    });

    redisClient.on('close', () => {
      logger.warn('Redis client connection closed');
      isConnected = false;
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to create Redis client', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return null;
  }
};

/**
 * Initialize Redis connection
 */
export const initializeRedis = async (): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) {
    return false;
  }

  try {
    await client.connect();
    const pong = await client.ping();
    if (pong === 'PONG') {
      isConnected = true;
      return true;
    }
    return false;
  } catch (error) {
    logger.warn('Redis connection failed for auth', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
};

/**
 * Secondary storage interface for better-auth
 */
export const createAuthSecondaryStorage = () => {
  const client = getRedisClient();
  
  return {
    get: async (key: string): Promise<string | null> => {
      if (!client || !isConnected) {
        return null;
      }
      try {
        return await client.get(`better-auth:${key}`);
      } catch (error) {
        logger.error('Redis get error', { key, error: error instanceof Error ? error.message : 'Unknown error' });
        return null;
      }
    },
    
    set: async (key: string, value: string, ttl?: number): Promise<void> => {
      if (!client || !isConnected) {
        return;
      }
      try {
        if (ttl) {
          await client.set(`better-auth:${key}`, value, 'EX', ttl);
        } else {
          await client.set(`better-auth:${key}`, value);
        }
      } catch (error) {
        logger.error('Redis set error', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    },
    
    delete: async (key: string): Promise<void> => {
      if (!client || !isConnected) {
        return;
      }
      try {
        await client.del(`better-auth:${key}`);
      } catch (error) {
        logger.error('Redis delete error', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    },
  };
};

/**
 * Check if Redis is connected
 */
export const isRedisConnectedForAuth = (): boolean => isConnected;

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    logger.info('Redis client closed for auth');
  }
};

export default {
  getRedisClient,
  initializeRedis,
  createAuthSecondaryStorage,
  isRedisConnected: isRedisConnectedForAuth,
  closeRedis,
};
