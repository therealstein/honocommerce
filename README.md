# Honocommerce

A fully open-source, WooCommerce REST API-compatible backend built from scratch in TypeScript using the Hono framework.

**No WordPress. No PHP. No WooCommerce plugin required.** Any frontend, mobile app, or integration that speaks the WooCommerce REST API speaks Honocommerce.

## Features

- 🚀 **100% WooCommerce REST API v3 compatible** at the HTTP contract level
- ⚡ **Bun + Hono** - Fast, edge-deployable runtime
- 🐘 **PostgreSQL** via Drizzle ORM
- ✅ **Zod** validation for all requests
- 📦 **BullMQ** for async job processing
- 🔐 **WooCommerce-compatible auth** (consumer_key/consumer_secret)

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker](https://docker.com) (for PostgreSQL and Redis)
- Node.js >= 20 (optional, for compatibility)

### Development

1. **Start the infrastructure:**
   ```bash
   bun run docker:up
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Run database migrations:**
   ```bash
   bun run db:push
   ```

4. **Start the development server:**
   ```bash
   bun run dev
   ```

The API will be available at `http://localhost:3000/wp-json/wc/v3/`

### Docker Development

Run the entire stack with Docker Compose:

```bash
docker compose up -d
docker compose logs -f api
```

## API Endpoints

All endpoints are available under `/wp-json/wc/v3/`:

### Products
- `GET/POST /products`
- `GET/PUT/DELETE /products/:id`
- `GET/POST /products/:id/variations`
- `POST /products/batch`

### Orders
- `GET/POST /orders`
- `GET/PUT/DELETE /orders/:id`
- `GET/POST /orders/:id/refunds`
- `POST /orders/batch`

### Customers
- `GET/POST /customers`
- `GET/PUT/DELETE /customers/:id`
- `POST /customers/batch`

### Coupons
- `GET/POST /coupons`
- `GET/PUT/DELETE /coupons/:id`
- `POST /coupons/batch`

### Webhooks
- `GET/POST /webhooks`
- `GET/PUT/DELETE /webhooks/:id`

### Reports
- `GET /reports`
- `GET /reports/sales`
- `GET /reports/top-sellers`

### Settings
- `GET /settings`
- `GET/PUT /settings/:group/:id`

### Shipping
- `GET/POST /shipping/zones`
- `GET/PUT/DELETE /shipping/zones/:id`

### Taxes
- `GET/POST /taxes`
- `GET/PUT/DELETE /taxes/:id`

## Authentication

Honocommerce uses WooCommerce-compatible API key authentication:

1. Create an API key pair (`ck_xxx` / `cs_xxx`)
2. Use HTTP Basic Auth:
   ```
   Username: consumer_key
   Password: consumer_secret
   ```

Example with curl:
```bash
curl -u ck_xxx:cs_xxx http://localhost:3000/wp-json/wc/v3/products
```

## Project Structure

```
honocommerce/
├── src/
│   ├── index.ts              # Entry point
│   ├── routes/               # Route handlers (thin)
│   ├── services/             # Business logic
│   ├── db/
│   │   ├── index.ts          # Drizzle client
│   │   └── schema/           # DB schemas
│   ├── middleware/           # Auth, error handling, rate limiting
│   ├── webhooks/             # Webhook dispatcher and receivers
│   ├── queue/                # BullMQ setup and workers
│   ├── lib/                  # Utilities (pagination, formatting)
│   └── types/                # TypeScript type definitions
├── drizzle.config.ts         # Drizzle ORM config
├── docker-compose.yml        # Postgres + Redis + API
├── Dockerfile                # Multi-stage build
└── package.json
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run test` | Run tests |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run docker:up` | Start Docker containers |
| `bun run docker:down` | Stop Docker containers |

## Error Format

All errors follow the WooCommerce format:

```json
{
  "code": "woocommerce_rest_product_invalid_id",
  "message": "Invalid ID.",
  "data": {
    "status": 404
  }
}
```

## Contributing

1. Read `AGENTS.md` for project conventions
2. Check `TODO.md` for current progress
3. Follow the code conventions:
   - TypeScript strict mode
   - Thin route handlers
   - Business logic in services
   - Zod validation on all inputs
   - WooCommerce-compatible response shapes

## License

MIT
