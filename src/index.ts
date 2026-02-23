/**
 * Honocommerce - WooCommerce REST API v3 Compatible Backend
 * Entry point, Hono app bootstrap
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import middleware
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limit';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { apiSecurityHeaders } from './middleware/security-headers';

// Import routes
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import customersRouter from './routes/customers';
import couponsRouter from './routes/coupons';
import webhooksRouter from './routes/webhooks';
import reportsRouter from './routes/reports';
import settingsRouter from './routes/settings';
import shippingRouter from './routes/shipping';
import taxesRouter from './routes/taxes';
import paymentGatewaysRouter from './routes/payment-gateways';
import dataRouter from './routes/data';
import pluginsRouter from './routes/plugins';
import adminRouter from './routes/admin';

// Import queue system
import { initializeQueues, isQueueEnabled, getQueueStats, shutdownQueues } from './queue';
import { startAllWorkers, stopAllWorkers } from './queue/workers';

// Import plugin system
import { initializePluginSystem, shutdownPluginSystem } from './services/plugin.service';

// Import better-auth
import { auth } from './lib/auth';
import { initializeRedis, closeRedis } from './lib/redis';

// Import logging and metrics
import logger from './lib/logger';
import { getMetricsExport } from './lib/metrics';

const app = new Hono();

// ============== GLOBAL MIDDLEWARE ==============

// Request ID (must be first for logging)
app.use('*', requestId());

// Request logging
app.use('*', requestLogger());

// Security headers
app.use('*', apiSecurityHeaders());

// CORS
const corsOrigins = process.env.CORS_ORIGINS ?? '*';
app.use('*', cors({
  origin: corsOrigins === '*' ? '*' : corsOrigins.split(',').map(s => s.trim()),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-ID', 'X-WP-Total', 'X-WP-TotalPages'],
  maxAge: 86400,
  credentials: true, // Required for cookies
}));

// Rate limiting
app.use('*', rateLimiter);

// Error handler
app.onError(errorHandler);

// ============== PUBLIC ENDPOINTS ==============

// Health check (no auth required)
app.get('/health', async (c) => {
  const queueStats = await getQueueStats();
  
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    queue: queueStats,
    version: process.env.npm_package_version ?? '1.0.0',
  });
});

// Prometheus metrics endpoint (optional, controlled by env)
const metricsEnabled = process.env.METRICS_ENABLED !== 'false';
const metricsPath = process.env.METRICS_PATH ?? '/metrics';

if (metricsEnabled) {
  app.get(metricsPath, async (c) => {
    const metrics = getMetricsExport();
    return c.text(metrics, 200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    });
  });
}

// ============== BETTER-AUTH HANDLER ==============

// Mount better-auth handler for admin authentication
// Handles: /api/auth/sign-in, /api/auth/sign-up, /api/auth/sign-out, /api/auth/session
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw);
});

// ============== ADMIN ROUTES ==============

// Mount admin routes (protected by better-auth session)
app.route('/admin', adminRouter);

// ============== WOOCOMMERCE API ROUTES ==============

const api = new Hono();
api.use('*', authMiddleware);

// Mount resource routers
api.route('/products', productsRouter);
api.route('/orders', ordersRouter);
api.route('/customers', customersRouter);
api.route('/coupons', couponsRouter);
api.route('/webhooks', webhooksRouter);
api.route('/reports', reportsRouter);
api.route('/settings', settingsRouter);
api.route('/shipping', shippingRouter);
api.route('/taxes', taxesRouter);
api.route('/payment-gateways', paymentGatewaysRouter);
api.route('/data', dataRouter);
api.route('/plugins', pluginsRouter);

// Mount API at WooCommerce-compatible path
app.route('/wp-json/wc/v3', api);

// ============== SERVER STARTUP ==============

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

logger.info('Starting Honocommerce server', { port });

// Initialize queue system and start workers
const initializeApp = async () => {
  // Skip queue initialization in test environment
  if (process.env.NODE_ENV === 'test') {
    logger.info('Test environment - skipping initialization');
    return;
  }
  
  // Initialize Redis for better-auth (optional but recommended)
  logger.info('Initializing Redis for auth...');
  const redisConnected = await initializeRedis();
  if (redisConnected) {
    logger.info('Redis connected for auth');
  } else {
    logger.warn('Redis not available for auth - using database only');
  }
  
  logger.info('Initializing queue system...');
  
  // Initialize queues (connects to Redis or sets up memory fallback)
  await initializeQueues();
  
  // Start workers (processes jobs from queues)
  startAllWorkers();
  
  if (isQueueEnabled()) {
    logger.info('Queue system enabled', { backend: 'redis' });
  } else {
    logger.warn('Queue system using in-memory fallback');
  }

  // Initialize plugin system
  logger.info('Initializing plugin system...');
  await initializePluginSystem();
  
  logger.info('Honocommerce initialized', {
    endpoints: {
      auth: '/api/auth/*',
      admin: '/admin/*',
      api: '/wp-json/wc/v3/*',
      health: '/health',
      metrics: metricsEnabled ? metricsPath : 'disabled',
    },
  });
};

// Start initialization
initializeApp().catch(err => {
  logger.error('Failed to initialize application', { error: err.message });
});

// ============== GRACEFUL SHUTDOWN ==============

const gracefulShutdown = async (signal: string) => {
  logger.info('Shutting down', { signal });
  
  // Shutdown plugin system
  await shutdownPluginSystem();
  
  // Stop accepting new jobs
  await stopAllWorkers();
  
  // Close queue connections
  await shutdownQueues();
  
  // Close Redis for auth
  await closeRedis();
  
  logger.info('Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
