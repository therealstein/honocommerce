/**
 * Inventory Service
 * Business logic for inventory management
 */

import { db } from '../db';
import { products } from '../db/schema/products';
import { eq } from 'drizzle-orm';

export interface InventoryUpdate {
  productId: number;
  quantity: number;
  operation: 'set' | 'increment' | 'decrement';
}

/**
 * Get stock quantity for a product
 */
export const getStockQuantity = async (productId: number): Promise<number | null> => {
  const [product] = await db
    .select({ stockQuantity: products.stockQuantity, manageStock: products.manageStock })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  
  if (!product) return null;
  if (!product.manageStock) return null;
  
  return product.stockQuantity ?? 0;
};

/**
 * Update stock quantity
 */
export const updateStock = async (update: InventoryUpdate): Promise<number | null> => {
  const { productId, quantity, operation } = update;
  
  const [current] = await db
    .select({ stockQuantity: products.stockQuantity })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  
  if (!current) return null;
  
  let newQuantity = current.stockQuantity ?? 0;
  
  switch (operation) {
    case 'set':
      newQuantity = quantity;
      break;
    case 'increment':
      newQuantity += quantity;
      break;
    case 'decrement':
      newQuantity = Math.max(0, newQuantity - quantity);
      break;
  }
  
  // Determine stock status
  const stockStatus = newQuantity > 0 ? 'instock' : 'outofstock';
  
  await db
    .update(products)
    .set({
      stockQuantity: newQuantity,
      stockStatus,
      dateModified: new Date(),
      dateModifiedGmt: new Date(),
    })
    .where(eq(products.id, productId));
  
  return newQuantity;
};

/**
 * Decrease stock for an order
 */
export const decreaseStockForOrder = async (items: Array<{ productId: number; quantity: number }>): Promise<void> => {
  for (const item of items) {
    await updateStock({
      productId: item.productId,
      quantity: item.quantity,
      operation: 'decrement',
    });
  }
};

/**
 * Increase stock for a cancelled order or refund
 */
export const increaseStockForRefund = async (items: Array<{ productId: number; quantity: number }>): Promise<void> => {
  for (const item of items) {
    await updateStock({
      productId: item.productId,
      quantity: item.quantity,
      operation: 'increment',
    });
  }
};

export const inventoryService = {
  getStockQuantity,
  updateStock,
  decreaseStockForOrder,
  increaseStockForRefund,
};

export default inventoryService;
