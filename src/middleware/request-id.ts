/**
 * Request ID Middleware
 * Assigns a unique ID to each request for tracing
 */

import type { Context, Next } from 'hono';
import { randomBytes } from 'crypto';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

/**
 * Generate a unique request ID
 */
const generateRequestId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `req_${timestamp}_${random}`;
};

/**
 * Request ID middleware
 * Adds a unique ID to each request and includes it in response headers
 */
export const requestId = (headerName: string = 'X-Request-ID') => {
  return async (c: Context, next: Next) => {
    // Check if request already has an ID (from load balancer, etc.)
    const existingId = c.req.header(headerName);
    const id = existingId ?? generateRequestId();

    // Store in context for use in other middleware/handlers
    c.set('requestId', id);

    await next();

    // Add to response headers
    c.res.headers.set(headerName, id);
  };
};

/**
 * Get the request ID from context
 */
export const getRequestId = (c: Context): string => {
  return c.get('requestId') ?? 'unknown';
};

export default requestId;
