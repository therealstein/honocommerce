/**
 * Payment Gateway Formatter
 */

export interface PaymentGatewayResponse {
  id: string;
  title: string;
  description: string;
  order: number;
  enabled: boolean;
  method_title: string;
  method_description: string;
  settings: Record<string, unknown>;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatPaymentGatewayResponse = (
  gateway: {
    id: string;
    title: string;
    description: string;
    order: number;
    enabled: boolean;
    method_title: string;
    method_description: string;
    settings: Record<string, unknown>;
  }
): PaymentGatewayResponse => ({
  id: gateway.id,
  title: gateway.title,
  description: gateway.description,
  order: gateway.order,
  enabled: gateway.enabled,
  method_title: gateway.method_title,
  method_description: gateway.method_description,
  settings: gateway.settings,
  _links: {
    self: [{ href: `/wp-json/wc/v3/payment-gateways/${gateway.id}` }],
    collection: [{ href: '/wp-json/wc/v3/payment-gateways' }],
  },
});

export const formatPaymentGatewayListResponse = (
  gateways: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
    enabled: boolean;
    method_title: string;
    method_description: string;
    settings: Record<string, unknown>;
  }>
): PaymentGatewayResponse[] =>
  gateways.map(formatPaymentGatewayResponse);
