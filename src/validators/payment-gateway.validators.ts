/**
 * Payment Gateways Validation Schemas
 */

import { z } from 'zod';

export const updatePaymentGatewaySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  order: z.number().int().optional(),
  enabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

export type UpdatePaymentGatewayInput = z.infer<typeof updatePaymentGatewaySchema>;
