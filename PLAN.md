# Honocommerce Implementation Plan

## Current State

The project structure is fully scaffolded with:
- ✅ Folder structure per AGENTS.md specification
- ✅ Docker setup (PostgreSQL + Redis + API)
- ✅ TypeScript configuration (strict mode)
- ✅ All route files created (stub implementations)
- ✅ All service files created (with basic CRUD)
- ✅ All DB schema files created
- ✅ Middleware (auth, error handler, rate limiter)
- ✅ BullMQ queue setup and workers
- ✅ Type definitions for WooCommerce API
- ✅ WooCommerce skill with full API reference

**Status**: Ready for implementation. Core infrastructure is in place.

---

## Phase 1: Get the Project Running

### Step 1.1: Install Dependencies
```bash
bun install
```

### Step 1.2: Start Infrastructure
```bash
bun run docker:up
```
This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### Step 1.3: Push Database Schema
```bash
bun run db:push
```

### Step 1.4: Create Initial API Key
Insert an API key directly into the database for testing:

```sql
INSERT INTO api_keys (consumer_key, consumer_secret, description, permissions)
VALUES (
  'ck_test12345678901234567890123456789012345678',
  'cs_test12345678901234567890123456789012345678',
  'Test API Key',
  'read_write'
);
```

### Step 1.5: Start Development Server
```bash
bun run dev
```

### Step 1.6: Verify Health Check
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Step 1.7: Test Auth
```bash
curl -u ck_test12345678901234567890123456789012345678:cs_test12345678901234567890123456789012345678 \
  http://localhost:3000/wp-json/wc/v3/products
```

---

## Phase 2: Core Infrastructure Completion

### Priority Order (from AGENTS.md)

| Priority | Task | File(s) | Status |
|----------|------|---------|--------|
| 1 | Auth middleware | `src/middleware/auth.ts` | ✅ Scaffolded |
| 2 | Products API | `src/routes/products.ts`, `src/services/product.service.ts` | ⏳ Stub |
| 3 | Orders API | `src/routes/orders.ts`, `src/services/order.service.ts` | ⏳ Stub |
| 4 | Customers API | `src/routes/customers.ts`, `src/services/customer.service.ts` | ⏳ Stub |
| 5 | Coupons API | `src/routes/coupons.ts`, `src/services/coupon.service.ts` | ⏳ Stub |

---

## Phase 3: Products API Implementation

### 3.1 Create Product Zod Schemas

Create `src/validators/product.validator.ts`:

```typescript
import { z } from 'zod';

export const productCreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['simple', 'grouped', 'external', 'variable']).default('simple'),
  status: z.enum(['draft', 'pending', 'private', 'publish']).default('draft'),
  featured: z.boolean().default(false),
  description: z.string().optional(),
  short_description: z.string().optional(),
  sku: z.string().optional(),
  regular_price: z.string().optional(),
  sale_price: z.string().optional(),
  // ... other fields
});

export const productUpdateSchema = productCreateSchema.partial();
```

### 3.2 Implement Product Routes (Thin Handlers)

Update `src/routes/products.ts` to use the service properly:

```typescript
router.get('/', async (c) => {
  const query = listQuerySchema.parse(c.req.query());
  const result = await productService.list(query);
  
  setPaginationHeaders(c, {
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.page,
    perPage: result.perPage,
  }, '/wp-json/wc/v3/products');
  
  return c.json(result.items);
});
```

### 3.3 Write Product Service Tests

Create `src/services/product.service.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { productService } from './product.service';

describe('ProductService', () => {
  describe('create', () => {
    it('should create a product with valid input', async () => {
      // ...
    });
    
    it('should generate slug from name', async () => {
      // ...
    });
  });
  
  describe('get', () => {
    it('should return null for non-existent product', async () => {
      // ...
    });
  });
});
```

### 3.4 Products API Checklist

- [ ] GET /products - List with pagination
- [ ] POST /products - Create with validation
- [ ] GET /products/:id - Single product
- [ ] PUT /products/:id - Update product
- [ ] DELETE /products/:id - Soft delete
- [ ] POST /products/batch - Batch operations
- [ ] Response shapes match WooCommerce exactly
- [ ] Error codes use WooCommerce naming
- [ ] Unit tests for all service functions

---

## Phase 4: Orders API Implementation

### 4.1 Order Zod Schemas

Create `src/validators/order.validator.ts`

### 4.2 Orders API Checklist

- [ ] GET /orders - List with filters (status, customer)
- [ ] POST /orders - Create with line items
- [ ] GET /orders/:id - Single order
- [ ] PUT /orders/:id - Update order
- [ ] DELETE /orders/:id - Soft delete
- [ ] GET /orders/:id/refunds - List refunds
- [ ] POST /orders/:id/refunds - Create refund
- [ ] Inventory decrements on order creation
- [ ] Inventory restores on order cancellation

---

## Phase 5: Customers API Implementation

### 5.1 Customers API Checklist

- [ ] GET /customers - List with pagination
- [ ] POST /customers - Create with email validation
- [ ] GET /customers/:id - Single customer
- [ ] PUT /customers/:id - Update customer
- [ ] DELETE /customers/:id - Soft delete
- [ ] GET /customers/:id/downloads - Download permissions
- [ ] POST /customers/batch - Batch operations

---

## Phase 6: Coupons API Implementation

- [ ] GET /coupons - List
- [ ] POST /coupons - Create
- [ ] GET /coupons/:id - Single coupon
- [ ] PUT /coupons/:id - Update
- [ ] DELETE /coupons/:id - Delete
- [ ] POST /coupons/batch - Batch

---

## Phase 7: Webhooks Implementation

- [ ] Webhook registration (CRUD)
- [ ] Webhook dispatcher integration
- [ ] HMAC signature generation
- [ ] Delivery logging
- [ ] Retry logic in worker

---

## Phase 8: Remaining Endpoints

### Reports
- [ ] GET /reports
- [ ] GET /reports/sales
- [ ] GET /reports/top-sellers
- [ ] GET /reports/orders/totals
- [ ] GET /reports/products/totals

### Settings
- [ ] GET /settings
- [ ] GET /settings/:group
- [ ] PUT /settings/:group/:id

### Shipping
- [ ] Zone CRUD
- [ ] Method CRUD
- [ ] Location management

### Taxes
- [ ] Tax rate CRUD
- [ ] Tax class management

### Payment Gateways
- [ ] List gateways
- [ ] Update gateway settings

---

## Phase 9: Production Readiness

### 9.1 Security
- [ ] Rate limiting per API key
- [ ] Input sanitization
- [ ] SQL injection prevention (Drizzle handles this)
- [ ] CORS configuration

### 9.2 Performance
- [ ] Database indexes
- [ ] Query optimization
- [ ] Connection pooling

### 9.3 Observability
- [ ] Structured logging
- [ ] Request ID tracking
- [ ] Health check endpoint
- [ ] Metrics endpoint

### 9.4 Documentation
- [ ] OpenAPI/Swagger spec
- [ ] Postman collection
- [ ] Deployment guide

---

## Autonomous Execution Strategy

### For Each Endpoint:

1. **Read the skill** - Load `.opencode/skills/woocommerce-api/SKILL.md`
2. **Check TODO** - Run todo-manager to see status
3. **Implement validator** - Create Zod schema
4. **Implement service** - Business logic only
5. **Implement route** - Thin handler calling service
6. **Format response** - Match WooCommerce shape exactly
7. **Write tests** - Happy path + 2 error cases
8. **Update TODO** - Mark as complete

### Validation Checklist Per Endpoint:

- [ ] Route file is thin (no business logic)
- [ ] Service contains all logic
- [ ] Zod validates input
- [ ] Response matches WooCommerce JSON
- [ ] Errors use WooCommerce format
- [ ] Pagination headers on list endpoints
- [ ] `_links` included in responses
- [ ] Unit test exists

---

## Quick Reference Commands

```bash
# Development
bun run dev                  # Start dev server
bun run test                 # Run tests
bun run test:coverage        # Run with coverage

# Database
bun run db:generate          # Generate migration
bun run db:push              # Push schema changes
bun run db:studio            # Open Drizzle Studio

# Docker
bun run docker:up            # Start containers
bun run docker:down          # Stop containers
bun run docker:logs          # View API logs
```

---

## Next Immediate Action

1. Run `bun install` to install dependencies
2. Run `bun run docker:up` to start PostgreSQL and Redis
3. Run `bun run db:push` to create database tables
4. Create a test API key in the database
5. Run `bun run dev` and verify health check
6. Start implementing Products API with proper validation and WooCommerce response formatting
