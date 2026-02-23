/**
 * Rate Limiter Middleware
 * Basic rate limiting for API endpoints
 */

import { Context, Next } from 'hono';
import { wcError, WcErrorCodes } from '../lib/wc-error';

// Simple in-memory rate limiting store
// In production, this should be Redis-based
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limiter configuration
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '100', 10); // requests per window

/**
 * Get client identifier (IP or API key)
 */
const getClientId = (c: Context): string => {
  // Use API key if available, otherwise fall back to IP
  const apiKey = c.get('apiKey');
  if (apiKey) {
    return `api:${apiKey.id}`;
  }
  
  // Get IP from various headers
  const forwardedFor = c.req.header('X-Forwarded-For');
  if (forwardedFor) {
    return `ip:${forwardedFor.split(',')[0].trim()}`;
  }
  
  const realIp = c.req.header('X-Real-IP');
  if (realIp) {
    return `ip:${realIp}`;
  }
  
  return 'ip:unknown';
};

/**
 * Rate limiter middleware
 */
export const rateLimiter = async (c: Context, next: Next) => {
  const clientId = getClientId(c);
  const now = Date.now();
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(clientId);
  
  if (!entry || entry.resetAt < now) {
    // Create new entry or reset expired entry
    entry = {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }
  
  entry.count++;
  rateLimitStore.set(clientId, entry);
  
  // Set rate limit headers
  c.header('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
  c.header('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count)));
  c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  
  // Check if rate limit exceeded
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return c.json(
      wcError(
        WcErrorCodes.CANNOT_VIEW,
        'Too many requests. Please try again later.',
        429
      ),
      429
    );
  }
  
  await next();
};

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute
