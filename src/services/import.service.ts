/**
 * Data Import Service
 * Import products, customers from CSV
 */

import { db } from '../db';
import { products } from '../db/schema/products';
import { customers } from '../db/schema/customers';
import { eq, and, sql } from 'drizzle-orm';
import { 
  csvToObjects, 
  parseBooleanFromCsv, 
  parseNumberFromCsv, 
  parseIntFromCsv 
} from '../lib/csv-utils';
import { z } from 'zod';
import { createProduct, getProductBySku, getProduct } from './product.service';
import { createCustomer, getCustomerByEmail, getCustomer, updateCustomer } from './customer.service';

// ============== IMPORT RESULT TYPES ==============

export interface ImportResult {
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  total: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

// ============== PRODUCT IMPORT ==============

const ProductImportSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().optional(),
  type: z.enum(['simple', 'grouped', 'external', 'variable']).optional(),
  status: z.enum(['draft', 'pending', 'private', 'publish']).optional(),
  featured: z.string().optional(),
  description: z.string().optional(),
  short_description: z.string().optional(),
  sku: z.string().optional(),
  price: z.string().optional(),
  regular_price: z.string().optional(),
  sale_price: z.string().optional(),
  stock_quantity: z.string().optional(),
  stock_status: z.enum(['instock', 'outofstock', 'onbackorder']).optional(),
  manage_stock: z.string().optional(),
  categories: z.string().optional(),
  tags: z.string().optional(),
  images: z.string().optional(),
  date_created: z.string().optional(),
});

export type ProductImportRow = z.infer<typeof ProductImportSchema>;

export interface ProductImportOptions {
  updateExisting?: boolean;  // Update products with matching SKU
  skipErrors?: boolean;       // Continue on errors
}

export const importProducts = async (
  csvData: string,
  options: ProductImportOptions = {}
): Promise<ImportResult> => {
  const { updateExisting = false, skipErrors = true } = options;
  const result: ImportResult = {
    created: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    errors: [],
  };

  // Check for empty CSV
  if (!csvData || csvData.trim() === '') {
    result.errors.push({
      row: 0,
      message: 'CSV data is empty',
    });
    return result;
  }

  let rows: Record<string, string>[];
  try {
    rows = csvToObjects(csvData);
  } catch (error) {
    result.errors.push({
      row: 0,
      message: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return result;
  }

  result.total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +1 for 0-index, +1 for header row

    try {
      // Validate row
      const validated = ProductImportSchema.safeParse(row);
      if (!validated.success) {
        result.failed++;
        const firstError = validated.error.errors[0];
        result.errors.push({
          row: rowNum,
          field: firstError?.path.join('.'),
          message: firstError?.message ?? 'Validation failed',
        });
        if (!skipErrors) break;
        continue;
      }

      const data = validated.data;

      // Check for existing product by SKU if updateExisting is true
      let existingProduct = null;
      if (updateExisting && data.sku) {
        existingProduct = await getProductBySku(data.sku);
      }

      // Unescape newlines in description fields
      const description = data.description?.replace(/\\n/g, '\n') ?? undefined;
      const shortDescription = data.short_description?.replace(/\\n/g, '\n') ?? undefined;

      if (existingProduct && updateExisting) {
        // Update existing product
        const updateData: Record<string, unknown> = {};
        
        if (data.name) updateData.name = data.name;
        if (data.status) updateData.status = data.status;
        if (data.regular_price) updateData.regularPrice = data.regular_price;
        if (data.sale_price) updateData.salePrice = data.sale_price;
        if (data.stock_quantity) updateData.stockQuantity = parseIntFromCsv(data.stock_quantity);
        if (data.stock_status) updateData.stockStatus = data.stock_status;
        if (data.manage_stock) updateData.manageStock = parseBooleanFromCsv(data.manage_stock);
        if (description !== undefined) updateData.description = description || null;
        if (shortDescription !== undefined) updateData.shortDescription = shortDescription || null;

        if (Object.keys(updateData).length > 0) {
          updateData.dateModified = new Date();
          await db
            .update(products)
            .set(updateData)
            .where(eq(products.id, existingProduct.id));
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // Create new product
        await createProduct({
          name: data.name,
          slug: data.slug,
          type: data.type ?? 'simple',
          status: data.status ?? 'draft',
          featured: data.featured ? parseBooleanFromCsv(data.featured) : false,
          description: description,
          short_description: shortDescription,
          sku: data.sku,
          regular_price: data.regular_price ?? data.price,
          sale_price: data.sale_price,
          stock_quantity: data.stock_quantity ? parseIntFromCsv(data.stock_quantity) : undefined,
          stock_status: data.stock_status ?? 'instock',
          manage_stock: data.manage_stock ? parseBooleanFromCsv(data.manage_stock) : false,
        });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        row: rowNum,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      if (!skipErrors) break;
    }
  }

  return result;
};

// ============== CUSTOMER IMPORT ==============

const CustomerImportSchema = z.object({
  email: z.string().email('Valid email is required'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  role: z.enum(['customer', 'administrator', 'editor', 'author', 'contributor', 'subscriber', 'shop_manager']).optional(),
  billing_first_name: z.string().optional(),
  billing_last_name: z.string().optional(),
  billing_email: z.string().optional(),
  billing_phone: z.string().optional(),
  billing_address_1: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_postcode: z.string().optional(),
  billing_country: z.string().optional(),
  shipping_first_name: z.string().optional(),
  shipping_last_name: z.string().optional(),
  shipping_address_1: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_state: z.string().optional(),
  shipping_postcode: z.string().optional(),
  shipping_country: z.string().optional(),
});

export type CustomerImportRow = z.infer<typeof CustomerImportSchema>;

export interface CustomerImportOptions {
  updateExisting?: boolean;  // Update customers with matching email
  skipErrors?: boolean;       // Continue on errors
}

export const importCustomers = async (
  csvData: string,
  options: CustomerImportOptions = {}
): Promise<ImportResult> => {
  const { updateExisting = false, skipErrors = true } = options;
  const result: ImportResult = {
    created: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    errors: [],
  };

  // Check for empty CSV
  if (!csvData || csvData.trim() === '') {
    result.errors.push({
      row: 0,
      message: 'CSV data is empty',
    });
    return result;
  }

  let rows: Record<string, string>[];
  try {
    rows = csvToObjects(csvData);
  } catch (error) {
    result.errors.push({
      row: 0,
      message: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return result;
  }

  result.total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +1 for 0-index, +1 for header row

    try {
      // Validate row
      const validated = CustomerImportSchema.safeParse(row);
      if (!validated.success) {
        result.failed++;
        const firstError = validated.error.errors[0];
        result.errors.push({
          row: rowNum,
          field: firstError?.path.join('.'),
          message: firstError?.message ?? 'Validation failed',
        });
        if (!skipErrors) break;
        continue;
      }

      const data = validated.data;

      // Check for existing customer by email if updateExisting is true
      let existingCustomer = null;
      if (updateExisting) {
        existingCustomer = await getCustomerByEmail(data.email);
      }

      // Build address objects from flattened fields
      const billing = {
        first_name: data.billing_first_name ?? data.first_name ?? '',
        last_name: data.billing_last_name ?? data.last_name ?? '',
        email: data.billing_email ?? data.email,
        phone: data.billing_phone ?? '',
        address_1: data.billing_address_1 ?? '',
        city: data.billing_city ?? '',
        state: data.billing_state ?? '',
        postcode: data.billing_postcode ?? '',
        country: data.billing_country ?? '',
      };

      const shipping = {
        first_name: data.shipping_first_name ?? data.first_name ?? '',
        last_name: data.shipping_last_name ?? data.last_name ?? '',
        address_1: data.shipping_address_1 ?? '',
        city: data.shipping_city ?? '',
        state: data.shipping_state ?? '',
        postcode: data.shipping_postcode ?? '',
        country: data.shipping_country ?? '',
      };

      if (existingCustomer && updateExisting) {
        // Update existing customer
        const updateData: Record<string, unknown> = {};
        
        // Note: updateCustomer expects snake_case field names
        if (data.first_name) updateData.first_name = data.first_name;
        if (data.last_name) updateData.last_name = data.last_name;
        if (data.username) updateData.username = data.username;
        if (data.role) updateData.role = data.role;
        
        // Always update addresses if any field is present
        const hasBilling = Object.values(billing).some(v => v);
        const hasShipping = Object.values(shipping).some(v => v);
        
        if (hasBilling) updateData.billing = billing;
        if (hasShipping) updateData.shipping = shipping;

        if (Object.keys(updateData).length > 0) {
          await updateCustomer(existingCustomer.id, updateData);
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // Create new customer
        await createCustomer({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          username: data.username,
          role: data.role ?? 'customer',
          billing,
          shipping,
        });
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        row: rowNum,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      if (!skipErrors) break;
    }
  }

  return result;
};

// ============== SERVICE EXPORT ==============

export const importService = {
  products: importProducts,
  customers: importCustomers,
};

export default importService;
