// Test environment setup
import { beforeAll, afterAll } from 'vitest';

// Setup test environment
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  // Use the actual database URL (already set in Docker env)
  // Tests run against the same DB as the app
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/honocommerce';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
});

afterAll(async () => {
  // Cleanup after all tests
});
