/**
 * WooCommerce Error Format Helper
 * All errors must follow the WooCommerce error format exactly
 */

export interface WcError {
  code: string;
  message: string;
  data: {
    status: number;
  };
}

/**
 * Create a WooCommerce-compatible error response
 */
export const wcError = (code: string, message: string, status: number): WcError => ({
  code,
  message,
  data: { status },
});

/**
 * Predefined error codes following WooCommerce naming convention
 */
export const WcErrorCodes = {
  // Auth errors
  CANNOT_VIEW: 'woocommerce_rest_cannot_view',
  
  // Product errors
  PRODUCT_INVALID_ID: 'woocommerce_rest_product_invalid_id',
  PRODUCT_SKU_EXISTS: 'woocommerce_rest_product_sku_already_exists',
  
  // Order errors
  ORDER_INVALID_ID: 'woocommerce_rest_order_invalid_id',
  
  // Customer errors
  CUSTOMER_INVALID_ID: 'woocommerce_rest_customer_invalid_id',
  CUSTOMER_EMAIL_EXISTS: 'woocommerce_rest_customer_email_already_exists',
  
  // Coupon errors
  COUPON_INVALID_ID: 'woocommerce_rest_coupon_invalid_id',
  
  // Subscription errors
  SUBSCRIPTION_INVALID_ID: 'woocommerce_rest_subscription_invalid_id',
  
  // General errors
  INVALID_PARAM: 'woocommerce_rest_invalid_param',
  MISSING_PARAM: 'woocommerce_rest_missing_param',
  TRASH_FAILED: 'woocommerce_rest_trash_failed',
  CANNOT_DELETE: 'woocommerce_rest_cannot_delete',
} as const;
