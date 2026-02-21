/**
 * Payment Gateways Routes
 * WooCommerce /payment-gateways endpoint handlers
 */

import { Hono } from 'hono';
import { paymentGatewayService } from '../services/payment-gateway.service';
import {
  formatPaymentGatewayResponse,
  formatPaymentGatewayListResponse,
} from '../lib/payment-gateway-formatter';
import { wcError } from '../lib/wc-error';
import { updatePaymentGatewaySchema } from '../validators/payment-gateway.validators';

const router = new Hono();

/**
 * GET /payment-gateways - List payment gateways
 */
router.get('/', async (c) => {
  const gateways = await paymentGatewayService.list();
  
  return c.json(formatPaymentGatewayListResponse(gateways));
});

/**
 * GET /payment-gateways/:id - Get payment gateway
 */
router.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  const gateway = await paymentGatewayService.get(id);
  
  if (!gateway) {
    return c.json(wcError('payment_gateway_invalid_id', 'Invalid payment gateway ID.', 404), 404);
  }
  
  return c.json(formatPaymentGatewayResponse(gateway));
});

/**
 * PUT /payment-gateways/:id - Update payment gateway
 */
router.put('/:id', async (c) => {
  const id = c.req.param('id');
  
  const gateway = await paymentGatewayService.get(id);
  
  if (!gateway) {
    return c.json(wcError('payment_gateway_invalid_id', 'Invalid payment gateway ID.', 404), 404);
  }
  
  const body = await c.req.json();
  const parsed = updatePaymentGatewaySchema.parse(body);
  
  const updated = await paymentGatewayService.update(id, parsed);
  
  return c.json(formatPaymentGatewayResponse(updated!));
});

export default router;
