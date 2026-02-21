/**
 * Honocommerce - WooCommerce REST API v3 Compatible Backend
 * Entry point, Hono app bootstrap
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

// Import middleware
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limit';

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

// Import queue system
import { initializeQueues, isQueueEnabled, getQueueStats, shutdownQueues } from './queue';
import { startAllWorkers, stopAllWorkers } from './queue/workers';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors());
app.use('*', rateLimiter);

// Error handler
app.onError(errorHandler);

// Health check (no auth required)
app.get('/health', async (c) => {
  const queueStats = await getQueueStats();
  
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    queue: queueStats,
  });
});

// API routes under /wp-json/wc/v3
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

// Mount API at WooCommerce-compatible path
app.route('/wp-json/wc/v3', api);

// Start server
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

console.log(`🚀 Honocommerce server running on port ${port}`);
console.log(`📡 API available at http://localhost:${port}/wp-json/wc/v3`);

// Initialize queue system and start workers
const initializeApp = async () => {
  // Skip queue initialization in test environment
  if (process.env.NODE_ENV === 'test') {
    console.log('🧪 Test environment - skipping queue initialization');
    return;
  }
  
  console.log('🔄 Initializing queue system...');
  
  // Initialize queues (connects to Redis or sets up memory fallback)
  await initializeQueues();
  
  // Start workers (processes jobs from queues)
  startAllWorkers();
  
  if (isQueueEnabled()) {
    console.log('✅ Queue system enabled (Redis connected)');
  } else {
    console.log('📦 Queue system using in-memory fallback');
  }
};

// Start initialization
initializeApp().catch(err => {
  console.error('Failed to initialize queue system:', err);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  // Stop accepting new jobs
  await stopAllWorkers();
  
  // Close queue connections
  await shutdownQueues();
  
  console.log('Goodbye!');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
