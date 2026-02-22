/**
 * Global Error Handler Middleware
 * Catches all errors and formats them as WooCommerce-compatible responses
 */

import { Context } from 'hono';
import { wcError, WcErrorCodes, WcError } from '../lib/wc-error';
import { ZodError } from 'zod';
import logger from '../lib/logger';

/**
 * Check if an error is a WooCommerce error
 */
const isWcError = (err: unknown): err is WcError => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    'data' in err
  );
};

/**
 * Format Zod validation errors
 */
const formatZodErrors = (error: ZodError): string => {
  return error.errors
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join('; ');
};

/**
 * Global error handler
 * Formats all errors as WooCommerce-compatible JSON responses
 */
export const errorHandler = (err: Error, c: Context) => {
  logger.error('Request error', { error: err.message, stack: err.stack });
  
  // If it's already a WooCommerce-formatted error, return it
  if (isWcError(err)) {
    return c.json(err, err.data.status as 400 | 401 | 404 | 500);
  }
  
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      wcError(
        WcErrorCodes.INVALID_PARAM,
        formatZodErrors(err),
        400
      ),
      400
    );
  }
  
  // Handle generic errors
  const status = (err as { status?: number }).status || 500;
  const message = err.message || 'Internal server error';
  
  return c.json(
    wcError(
      WcErrorCodes.CANNOT_DELETE,
      message,
      status
    ),
    status as 400 | 401 | 404 | 500
  );
};
