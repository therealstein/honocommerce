/**
 * Plugin System Types
 * Defines interfaces and types for the plugin architecture
 */

// ============== PLUGIN METADATA ==============

export interface PluginManifest {
  /** Unique plugin identifier (e.g., 'order-status-checker') */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description: string;
  /** Plugin author */
  author: string;
  /** Minimum Honocommerce version required */
  minVersion?: string;
  /** Maximum Honocommerce version supported */
  maxVersion?: string;
  /** Plugin homepage URL */
  homepage?: string;
  /** Plugin repository URL */
  repository?: string;
  /** Plugin license */
  license?: string;
  /** Plugin dependencies on other plugins */
  dependencies?: PluginDependency[];
  /** Plugin configuration schema (JSON Schema) */
  configSchema?: Record<string, unknown>;
  /** Default configuration values */
  defaultConfig?: Record<string, unknown>;
  /** Hooks this plugin subscribes to */
  hooks?: string[];
  /** Scheduled tasks */
  schedules?: PluginSchedule[];
  /**
   * Database migrations to run during install
   * Paths are relative to plugin directory
   */
  migrations?: string[];
  /**
   * SQL statements to run during uninstall (cleanup)
   * Use with caution - typically just DROP TABLE statements
   */
  uninstallSql?: string[];
}

export interface PluginDependency {
  pluginId: string;
  minVersion?: string;
  maxVersion?: string;
  optional?: boolean;
}

export interface PluginSchedule {
  /** Schedule identifier */
  id: string;
  /** Cron expression or interval in milliseconds */
  schedule: string;
  /** Description of what this schedule does */
  description?: string;
}

// ============== PLUGIN ROUTES ==============

/**
 * Plugin Route Definition
 * Allows plugins to register their own REST endpoints
 */
export interface PluginRoute {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Route path (will be mounted under /wp-json/wc/v3/{basePath}) */
  path: string;
  /** Route handler function */
  handler: (c: unknown) => Promise<unknown>;
  /** Optional middleware to apply before handler */
  middleware?: Array<(c: unknown, next: () => Promise<unknown>) => Promise<unknown>>;
}

/**
 * Plugin Routes Configuration
 * Defines a collection of routes with a base path
 */
export interface PluginRoutes {
  /** Base path for all routes (e.g., 'subscriptions') */
  basePath: string;
  /** Route definitions */
  routes: PluginRoute[];
}

// ============== PLUGIN LIFECYCLE ==============

export interface Plugin {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Called when plugin is installed */
  install?: (context: PluginContext) => Promise<void>;
  /** Called when plugin is activated */
  activate?: (context: PluginContext) => Promise<void>;
  /** Called when plugin is deactivated */
  deactivate?: (context: PluginContext) => Promise<void>;
  /** Called when plugin is uninstalled */
  uninstall?: (context: PluginContext) => Promise<void>;
  /** Hook handlers */
  hooks?: PluginHooks;
  /** Scheduled task handlers */
  schedules?: PluginScheduleHandlers;
  /** Routes to register when plugin is active */
  routes?: PluginRoutes;
}

export interface PluginContext {
  /** Plugin ID */
  pluginId: string;
  /** Get plugin configuration */
  getConfig: () => Promise<Record<string, unknown>>;
  /** Set plugin configuration */
  setConfig: (config: Record<string, unknown>) => Promise<void>;
  /** Get a single config value */
  getConfigValue: <T>(key: string, defaultValue?: T) => Promise<T>;
  /** Set a single config value */
  setConfigValue: (key: string, value: unknown) => Promise<void>;
  /** Log a message */
  log: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: Record<string, unknown>) => Promise<void>;
  /** Access to services */
  services: PluginServices;
}

export interface PluginServices {
  // Product services
  getProduct: (id: number) => Promise<unknown>;
  listProducts: (params?: Record<string, unknown>) => Promise<unknown>;
  createProduct: (data: Record<string, unknown>) => Promise<unknown>;
  updateProduct: (id: number, data: Record<string, unknown>) => Promise<unknown>;
  deleteProduct: (id: number, force?: boolean) => Promise<unknown>;
  
  // Order services
  getOrder: (id: number) => Promise<unknown>;
  listOrders: (params?: Record<string, unknown>) => Promise<unknown>;
  createOrder: (data: Record<string, unknown>) => Promise<unknown>;
  updateOrder: (id: number, data: Record<string, unknown>) => Promise<unknown>;
  deleteOrder: (id: number, force?: boolean) => Promise<unknown>;
  
  // Customer services
  getCustomer: (id: number) => Promise<unknown>;
  getCustomerByEmail: (email: string) => Promise<unknown>;
  listCustomers: (params?: Record<string, unknown>) => Promise<unknown>;
  createCustomer: (data: Record<string, unknown>) => Promise<unknown>;
  updateCustomer: (id: number, data: Record<string, unknown>) => Promise<unknown>;
  deleteCustomer: (id: number, force?: boolean) => Promise<unknown>;
  
  // Webhook services
  dispatchWebhook: (event: string, data: Record<string, unknown>) => Promise<void>;
  
  // Database access
  db: {
    query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
    execute: (sql: string, params?: unknown[]) => Promise<void>;
  };
  
  // Queue access
  queue: {
    addJob: (queue: string, data: Record<string, unknown>) => Promise<void>;
  };
}

// ============== HOOK SYSTEM ==============

export type HookCallback<T = unknown> = (data: T, context: HookContext) => Promise<T | void>;

export interface HookContext {
  pluginId: string;
  hookName: string;
  timestamp: Date;
}

export interface HookRegistration {
  pluginId: string;
  hookName: string;
  callback: HookCallback;
  priority: number;
}

export interface PluginHooks {
  // Order hooks
  'order.created'?: HookCallback<OrderEventData>;
  'order.updated'?: HookCallback<OrderEventData>;
  'order.deleted'?: HookCallback<OrderEventData>;
  'order.status_changed'?: HookCallback<OrderStatusChangeData>;
  'order.refunded'?: HookCallback<OrderRefundData>;
  
  // Product hooks
  'product.created'?: HookCallback<ProductEventData>;
  'product.updated'?: HookCallback<ProductEventData>;
  'product.deleted'?: HookCallback<ProductEventData>;
  
  // Customer hooks
  'customer.created'?: HookCallback<CustomerEventData>;
  'customer.updated'?: HookCallback<CustomerEventData>;
  'customer.deleted'?: HookCallback<CustomerEventData>;
  
  // Coupon hooks
  'coupon.created'?: HookCallback<CouponEventData>;
  'coupon.updated'?: HookCallback<CouponEventData>;
  'coupon.deleted'?: HookCallback<CouponEventData>;
  
  // Webhook hooks
  'webhook.dispatch'?: HookCallback<WebhookDispatchData>;
  'webhook.delivered'?: HookCallback<WebhookResultData>;
  'webhook.failed'?: HookCallback<WebhookResultData>;
}

// ============== EVENT DATA TYPES ==============

export interface OrderEventData {
  order: {
    id: number;
    status: string;
    total: string;
    customerId: number | null;
    lineItems: Array<{
      id: number;
      productId: number;
      quantity: number;
      name: string;
    }>;
    metaData: Array<{ key: string; value: unknown }> | null;
    dateCreated: Date;
    dateModified: Date;
  };
}

export interface OrderStatusChangeData {
  orderId: number;
  previousStatus: string;
  newStatus: string;
  order: OrderEventData['order'];
}

export interface OrderRefundData {
  orderId: number;
  refundId: number;
  amount: string;
  reason: string | null;
  order: OrderEventData['order'];
}

export interface ProductEventData {
  product: {
    id: number;
    name: string;
    type: string;
    status: string;
    sku: string | null;
    price: string | null;
    stockQuantity: number | null;
    stockStatus: string;
    metaData: Array<{ key: string; value: unknown }> | null;
    dateCreated: Date;
    dateModified: Date;
  };
}

export interface CustomerEventData {
  customer: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    metaData: Array<{ key: string; value: unknown }> | null;
    dateCreated: Date;
    dateModified: Date;
  };
}

export interface CouponEventData {
  coupon: {
    id: number;
    code: string;
    amount: string;
    discountType: string;
    usageCount: number;
    metaData: Array<{ key: string; value: unknown }> | null;
    dateCreated: Date;
    dateModified: Date;
  };
}

export interface WebhookDispatchData {
  webhookId: number;
  event: string;
  payload: Record<string, unknown>;
  url: string;
}

export interface WebhookResultData {
  webhookId: number;
  event: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  duration: number;
}

// ============== SCHEDULE HANDLERS ==============

export type ScheduleHandler = (context: PluginContext) => Promise<void>;

export interface PluginScheduleHandlers {
  [scheduleId: string]: ScheduleHandler;
}

// ============== PLUGIN STATE ==============

export type PluginStatus = 'installed' | 'active' | 'inactive' | 'error';

export interface PluginState {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  status: PluginStatus;
  isSystem: boolean;
  config: Record<string, unknown>;
  dateInstalled: Date;
  dateActivated: Date | null;
  lastError: string | null;
}

// ============== PLUGIN LOG ==============

export interface PluginLogEntry {
  id: number;
  pluginId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data: Record<string, unknown> | null;
  timestamp: Date;
}

// ============== SCHEDULED TASK ==============

export interface ScheduledTask {
  id: number;
  pluginId: string;
  scheduleId: string;
  cronExpression: string | null;
  intervalMs: number | null;
  nextRun: Date | null;
  lastRun: Date | null;
  isRunning: boolean;
  isEnabled: boolean;
}
