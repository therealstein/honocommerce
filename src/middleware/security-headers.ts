/**
 * Security Headers Middleware
 * Adds security-related HTTP headers to all responses
 */

import type { Context, Next } from 'hono';

export interface SecurityHeadersOptions {
  /** Content Security Policy directives */
  contentSecurityPolicy?: string | false;
  /** X-Frame-Options header */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  /** X-Content-Type-Options header */
  contentTypeOptions?: 'nosniff' | false;
  /** X-XSS-Protection header */
  xssProtection?: string | false;
  /** Referrer-Policy header */
  referrerPolicy?: string | false;
  /** Permissions-Policy header */
  permissionsPolicy?: string | false;
  /** Strict-Transport-Security header */
  strictTransportSecurity?: string | false;
}

const defaultOptions: SecurityHeadersOptions = {
  contentSecurityPolicy: "default-src 'self'",
  frameOptions: 'DENY',
  contentTypeOptions: 'nosniff',
  xssProtection: '1; mode=block',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
  strictTransportSecurity: false, // Only enable with HTTPS
};

/**
 * Security headers middleware
 */
export const securityHeaders = (options: Partial<SecurityHeadersOptions> = {}) => {
  const opts = { ...defaultOptions, ...options };

  return async (c: Context, next: Next) => {
    await next();

    // Content-Security-Policy
    if (opts.contentSecurityPolicy !== false) {
      c.res.headers.set('Content-Security-Policy', opts.contentSecurityPolicy!);
    }

    // X-Frame-Options
    if (opts.frameOptions !== false) {
      c.res.headers.set('X-Frame-Options', opts.frameOptions!);
    }

    // X-Content-Type-Options
    if (opts.contentTypeOptions !== false) {
      c.res.headers.set('X-Content-Type-Options', opts.contentTypeOptions!);
    }

    // X-XSS-Protection (legacy but still useful for older browsers)
    if (opts.xssProtection !== false) {
      c.res.headers.set('X-XSS-Protection', opts.xssProtection!);
    }

    // Referrer-Policy
    if (opts.referrerPolicy !== false) {
      c.res.headers.set('Referrer-Policy', opts.referrerPolicy!);
    }

    // Permissions-Policy
    if (opts.permissionsPolicy !== false) {
      c.res.headers.set('Permissions-Policy', opts.permissionsPolicy!);
    }

    // Strict-Transport-Security (only if using HTTPS)
    if (opts.strictTransportSecurity !== false) {
      c.res.headers.set('Strict-Transport-Security', opts.strictTransportSecurity!);
    }

    // Remove server identification
    c.res.headers.delete('Server');
    c.res.headers.delete('X-Powered-By');
  };
};

/**
 * API-specific security headers (more permissive for API usage)
 */
export const apiSecurityHeaders = () => {
  return async (c: Context, next: Next) => {
    await next();

    // X-Content-Type-Options
    c.res.headers.set('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options
    c.res.headers.set('X-Frame-Options', 'DENY');

    // Referrer-Policy
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Cache-Control for API responses
    if (!c.res.headers.has('Cache-Control')) {
      c.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    // Remove server identification
    c.res.headers.delete('Server');
    c.res.headers.delete('X-Powered-By');
  };
};

export default securityHeaders;
