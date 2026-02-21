/**
 * Settings Service
 */

import { db } from '../db';
import { settings, type Setting, type NewSetting } from '../db/schema/settings';
import { eq, and } from 'drizzle-orm';

// Default settings groups
const settingsGroups = [
  { id: 'general', label: 'General', description: 'General settings' },
  { id: 'products', label: 'Products', description: 'Product settings' },
  { id: 'tax', label: 'Tax', description: 'Tax settings' },
  { id: 'shipping', label: 'Shipping', description: 'Shipping settings' },
  { id: 'checkout', label: 'Checkout', description: 'Checkout settings' },
  { id: 'account', label: 'Account', description: 'Account settings' },
  { id: 'email', label: 'Email', description: 'Email settings' },
  { id: 'integration', label: 'Integration', description: 'Integration settings' },
];

// Default settings per group
const defaultSettings: Record<string, Array<{ id: string; label: string; type: string; default: string }>> = {
  general: [
    { id: 'woocommerce_store_address', label: 'Address line 1', type: 'text', default: '' },
    { id: 'woocommerce_store_address_2', label: 'Address line 2', type: 'text', default: '' },
    { id: 'woocommerce_store_city', label: 'City', type: 'text', default: '' },
    { id: 'woocommerce_default_country', label: 'Country / State', type: 'select', default: 'US:CA' },
    { id: 'woocommerce_store_postcode', label: 'Postcode / ZIP', type: 'text', default: '' },
    { id: 'woocommerce_currency', label: 'Currency', type: 'select', default: 'USD' },
    { id: 'woocommerce_currency_pos', label: 'Currency position', type: 'select', default: 'left' },
    { id: 'woocommerce_price_thousand_sep', label: 'Thousand separator', type: 'text', default: ',' },
    { id: 'woocommerce_price_decimal_sep', label: 'Decimal separator', type: 'text', default: '.' },
    { id: 'woocommerce_price_num_decimals', label: 'Number of decimals', type: 'number', default: '2' },
  ],
  products: [
    { id: 'woocommerce_shop_page_id', label: 'Shop page', type: 'select', default: '' },
    { id: 'woocommerce_cart_page_id', label: 'Cart page', type: 'select', default: '' },
    { id: 'woocommerce_checkout_page_id', label: 'Checkout page', type: 'select', default: '' },
    { id: 'woocommerce_myaccount_page_id', label: 'My account page', type: 'select', default: '' },
    { id: 'woocommerce_weight_unit', label: 'Weight unit', type: 'select', default: 'kg' },
    { id: 'woocommerce_dimension_unit', label: 'Dimensions unit', type: 'select', default: 'cm' },
  ],
  tax: [
    { id: 'woocommerce_calc_taxes', label: 'Enable tax calculations', type: 'checkbox', default: 'no' },
    { id: 'woocommerce_tax_based_on', label: 'Calculate tax based on', type: 'select', default: 'shipping' },
    { id: 'woocommerce_shipping_tax_class', label: 'Shipping tax class', type: 'select', default: '' },
    { id: 'woocommerce_tax_round_at_subtotal', label: 'Rounding', type: 'checkbox', default: 'no' },
  ],
};

export const getSettingsGroups = () => {
  return settingsGroups;
};

export const getSettingsGroup = async (groupId: string) => {
  const group = settingsGroups.find(g => g.id === groupId);
  if (!group) return null;
  
  // Get settings from database
  const dbSettings = await db
    .select()
    .from(settings)
    .where(eq(settings.group, groupId));
  
  // Merge with defaults
  const defaults = defaultSettings[groupId] || [];
  const mergedSettings = defaults.map(def => {
    const dbSetting = dbSettings.find(s => s.settingId === def.id);
    return {
      id: def.id,
      label: def.label,
      description: '',
      type: def.type,
      default: def.default,
      value: dbSetting?.value ?? def.default,
      options: dbSetting?.options ?? {},
      _links: {
        self: [{ href: `/wp-json/wc/v3/settings/${groupId}/${def.id}` }],
        collection: [{ href: `/wp-json/wc/v3/settings/${groupId}` }],
      },
    };
  });
  
  return {
    id: group.id,
    label: group.label,
    description: group.description,
    settings: mergedSettings,
  };
};

export const getSetting = async (groupId: string, settingId: string) => {
  const group = await getSettingsGroup(groupId);
  if (!group) return null;
  
  const setting = group.settings.find(s => s.id === settingId);
  return setting || null;
};

export const updateSetting = async (groupId: string, settingId: string, value: string) => {
  const existing = await getSetting(groupId, settingId);
  if (!existing) return null;
  
  // Check if setting exists in DB
  const [dbSetting] = await db
    .select()
    .from(settings)
    .where(and(eq(settings.group, groupId), eq(settings.settingId, settingId)));
  
  if (dbSetting) {
    // Update existing
    const [updated] = await db
      .update(settings)
      .set({ value, dateModified: new Date() })
      .where(eq(settings.id, dbSetting.id))
      .returning();
    
    return {
      ...existing,
      value: updated.value,
    };
  } else {
    // Create new
    const defaults = defaultSettings[groupId]?.find(d => d.id === settingId);
    await db.insert(settings).values({
      group: groupId,
      settingId,
      label: existing.label,
      description: existing.description,
      type: existing.type,
      defaultValue: existing.default,
      value,
      options: existing.options,
      dateCreated: new Date(),
      dateModified: new Date(),
    });
    
    return { ...existing, value };
  }
};

export const batchUpdateSettings = async (groupId: string, updates: Array<{ id: string; value: string }>) => {
  const results = [];
  for (const update of updates) {
    const result = await updateSetting(groupId, update.id, update.value);
    if (result) results.push(result);
  }
  return results;
};

export const settingService = {
  getGroups: getSettingsGroups,
  getGroup: getSettingsGroup,
  get: getSetting,
  update: updateSetting,
  batchUpdate: batchUpdateSettings,
};

export default settingService;
