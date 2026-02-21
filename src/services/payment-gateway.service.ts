/**
 * Payment Gateways Service
 * Business logic for payment gateway operations
 */

import { db } from '../db';
import { settings } from '../db/schema/settings';
import { eq, and } from 'drizzle-orm';

// Default payment gateways (WooCommerce defaults)
const defaultGateways = [
  {
    id: 'bacs',
    title: 'Direct bank transfer',
    description: 'Make your payment directly into our bank account. Please use your Order ID as the payment reference.',
    order: 1,
    enabled: true,
    method_title: 'Direct bank transfer',
    method_description: 'Allows payments by bank transfer.',
  },
  {
    id: 'cheque',
    title: 'Check payments',
    description: 'Please send a check to Store Name, Store Street, Store Town, Store State / County, Store Postcode.',
    order: 2,
    enabled: false,
    method_title: 'Check payments',
    method_description: 'Allows check payments.',
  },
  {
    id: 'cod',
    title: 'Cash on delivery',
    description: 'Pay with cash upon delivery.',
    order: 3,
    enabled: false,
    method_title: 'Cash on delivery',
    method_description: 'Allows cash on delivery.',
  },
];

interface PaymentGateway {
  id: string;
  title: string;
  description: string;
  order: number;
  enabled: boolean;
  method_title: string;
  method_description: string;
  settings: Record<string, unknown>;
}

const getGatewaySettings = async (gatewayId: string): Promise<Record<string, { value: string }>> => {
  const dbSettings = await db
    .select()
    .from(settings)
    .where(and(eq(settings.group, 'payment'), eq(settings.settingId, gatewayId)));
  
  if (dbSettings.length === 0) return {};
  
  const result: Record<string, { value: string }> = {};
  for (const setting of dbSettings) {
    if (setting.value) {
      try {
        const parsed = JSON.parse(setting.value);
        result.gateway_enabled = { value: parsed.enabled ? 'yes' : 'no' };
        result.gateway_title = { value: parsed.title ?? '' };
        result.gateway_description = { value: parsed.description ?? '' };
        result.gateway_order = { value: String(parsed.order ?? 0) };
      } catch {
        // Ignore parse errors
      }
    }
  }
  return result;
};

const saveGatewaySettings = async (
  gatewayId: string,
  data: { title?: string; description?: string; order?: number; enabled?: boolean }
): Promise<void> => {
  // Check if settings exist
  const [existing] = await db
    .select()
    .from(settings)
    .where(and(eq(settings.group, 'payment'), eq(settings.settingId, gatewayId)));
  
  const currentData = existing?.value ? JSON.parse(existing.value) : {};
  const newData = { ...currentData, ...data };
  
  if (existing) {
    await db
      .update(settings)
      .set({ value: JSON.stringify(newData), dateModified: new Date() })
      .where(eq(settings.id, existing.id));
  } else {
    await db.insert(settings).values({
      group: 'payment',
      settingId: gatewayId,
      label: gatewayId,
      description: `Payment gateway: ${gatewayId}`,
      type: 'object',
      defaultValue: '',
      value: JSON.stringify(newData),
      options: {},
      dateCreated: new Date(),
      dateModified: new Date(),
    });
  }
};

export const listPaymentGateways = async (): Promise<PaymentGateway[]> => {
  const gateways: PaymentGateway[] = [];
  
  for (const gateway of defaultGateways) {
    const dbSettings = await getGatewaySettings(gateway.id);
    
    // Override defaults with saved settings
    const enabled = dbSettings.gateway_enabled?.value === 'yes' 
      ? true 
      : dbSettings.gateway_enabled?.value === 'no' 
        ? false 
        : gateway.enabled;
    
    const title = dbSettings.gateway_title?.value ?? gateway.title;
    const description = dbSettings.gateway_description?.value ?? gateway.description;
    const order = parseInt(dbSettings.gateway_order?.value ?? String(gateway.order), 10);
    
    gateways.push({
      id: gateway.id,
      title,
      description,
      order,
      enabled,
      method_title: gateway.method_title,
      method_description: gateway.method_description,
      settings: dbSettings,
    });
  }
  
  return gateways.sort((a, b) => a.order - b.order);
};

export const getPaymentGateway = async (id: string): Promise<PaymentGateway | null> => {
  const gateway = defaultGateways.find(g => g.id === id);
  
  if (!gateway) return null;
  
  const dbSettings = await getGatewaySettings(id);
  
  const enabled = dbSettings.gateway_enabled?.value === 'yes' 
    ? true 
    : dbSettings.gateway_enabled?.value === 'no' 
      ? false 
      : gateway.enabled;
  
  const title = dbSettings.gateway_title?.value ?? gateway.title;
  const description = dbSettings.gateway_description?.value ?? gateway.description;
  const order = parseInt(dbSettings.gateway_order?.value ?? String(gateway.order), 10);
  
  return {
    id: gateway.id,
    title,
    description,
    order,
    enabled,
    method_title: gateway.method_title,
    method_description: gateway.method_description,
    settings: dbSettings,
  };
};

export const updatePaymentGateway = async (
  id: string,
  input: { title?: string; description?: string; order?: number; enabled?: boolean; settings?: Record<string, unknown> }
): Promise<PaymentGateway | null> => {
  const gateway = defaultGateways.find(g => g.id === id);
  
  if (!gateway) return null;
  
  await saveGatewaySettings(id, {
    title: input.title,
    description: input.description,
    order: input.order,
    enabled: input.enabled,
  });
  
  return getPaymentGateway(id);
};

export const paymentGatewayService = {
  list: listPaymentGateways,
  get: getPaymentGateway,
  update: updatePaymentGateway,
};

export default paymentGatewayService;
