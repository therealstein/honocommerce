/**
 * Request Logging Middleware
 * Logs all HTTP requests with timing and status
 */

import type { Context, Next } from 'hono';
import { getRequestId } from './request-id';
import { logRequest } from '../lib/logger';
import { httpRequestsTotal, httpRequestDuration } from '../lib/metrics';

/**
 * Request logging middleware
 */
export const requestLogger = () => {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const requestId = getRequestId(c);
    const method = c.req.method;
    const path = c.req.path;

    // Log incoming request
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug(`${method} ${path} - Request started`, {
        request_id: requestId,
        method,
        path,
        query: c.req.query(),
      });
    }

    await next();

    const duration = Date.now() - startTime;
    const status = c.res.status;

    // Log completed request
    logRequest(requestId, method, path, status, duration);

    // Record metrics
    httpRequestsTotal(method, path, status);
    httpRequestDuration(method, path, duration);
  };
};

export default requestLogger;
