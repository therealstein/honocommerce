/**
 * Admin Routes Index
 * Mounts all admin routes with authentication middleware
 */

import { Hono } from "hono";
import { authApi } from "../../lib/auth";
import apiKeysRouter from "./api-keys";

const router = new Hono();

/**
 * Admin authentication middleware
 * Requires valid better-auth session with admin role
 */
const adminAuthMiddleware = async (c: any, next: any) => {
  try {
    const session = await authApi.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json(
        {
          code: "unauthorized",
          message: "Authentication required. Please sign in first.",
          data: { status: 401 },
        },
        401
      );
    }

    if (session.user.role !== "admin") {
      return c.json(
        {
          code: "forbidden",
          message: "Admin access required. You do not have permission to access this resource.",
          data: { status: 403 },
        },
        403
      );
    }

    // Store session in context for use in routes
    c.set("session", session);
    c.set("user", session.user);

    await next();
  } catch (error) {
    return c.json(
      {
        code: "unauthorized",
        message: "Invalid session. Please sign in again.",
        data: { status: 401 },
      },
      401
    );
  }
};

// Apply admin auth middleware to all admin routes
router.use("*", adminAuthMiddleware);

// Mount admin sub-routes
router.route("/api-keys", apiKeysRouter);

/**
 * GET /admin
 * Admin dashboard info
 */
router.get("/", (c) => {
  const session = c.get("session");
  return c.json({
    message: "Honocommerce Admin API",
    version: "1.0.0",
    user: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    },
    endpoints: {
      api_keys: "/admin/api-keys",
    },
  });
});

/**
 * GET /admin/me
 * Current admin user info
 */
router.get("/me", (c) => {
  const session = c.get("session");
  return c.json({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    created_at: session.user.createdAt,
  });
});

export default router;
