// src/lib/productMetricsCalculator.ts

import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';

interface ProductMetrics {
  avgSellingPrice: number;
  totalSold: number;
  totalReturn: number;
  last30DaysSold: number;
  last30DaysReturn: number;
  daysSinceLastOrder: number;
  returnRate: number;
  qtyRequire: number;
  productStatus: 'Buyable' | 'Not Buyable' | 'Disable';
  lastCalculated: Date;
  calculationVersion: string;
}

interface CalculationProgress {
  processed: number;
  total: number;
  currentProduct: string;
  errors: string[];
}

/**
 * Calculate metrics for a single product
 */
export async function calculateProductMetrics(
  integrationId: string, 
  productData: any
): Promise<ProductMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const sku = productData.sku || productData.product_label_number || 'N/A';
  const stockTotal = productData.stock_at_takealot_total || 0;

  // Initialize metrics
  let totalSold = 0;
  let totalReturn = 0;
  let last30DaysSold = 0;
  let last30DaysReturn = 0;
  let daysSinceLastOrder = 999;
  let totalProductSoldAmount = 0;

  try {
    // Get sales data from multiple possible collections
    const salesCollections = ['takealotSales', 'takealot_sales', 'sales'];
    
    for (const collectionName of salesCollections) {
      try {
        const salesQuery = query(
          collection(db, collectionName),
          where('integrationId', '==', integrationId),
          where('sku', '==', sku)
        );
        
        const salesSnapshot = await getDocs(salesQuery);
        
        salesSnapshot.forEach(saleDoc => {
          const sale = saleDoc.data();
          const quantity = sale.quantity || sale.quantity_sold || sale.units_sold || 1;
          const orderDate = sale.order_date || sale.sale_date;
          const salePrice = sale.selling_price || sale.price || productData.selling_price || 0;
          
          if (orderDate) {
            const saleDate = new Date(orderDate);
            if (!isNaN(saleDate.getTime())) {
              // Calculate days since last order
              const daysDiff = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysDiff < daysSinceLastOrder) {
                daysSinceLastOrder = daysDiff;
              }
              
              // Check if it's a return
              const isReturn = sale.is_return || 
                             sale.return_status || 
                             (sale.order_status && sale.order_status.toLowerCase().includes('return')) ||
                             quantity < 0;
              
              if (isReturn) {
                const returnQty = Math.abs(quantity);
                totalReturn += returnQty;
                if (saleDate >= thirtyDaysAgo) {
                  last30DaysReturn += returnQty;
                }
              } else {
                totalSold += quantity;
                totalProductSoldAmount += quantity * salePrice;
                if (saleDate >= thirtyDaysAgo) {
                  last30DaysSold += quantity;
                }
              }
            }
          }
        });
        
        if (salesSnapshot.size > 0) break; // Found data, no need to check other collections
      } catch (error) {
        console.warn(`Could not query collection ${collectionName}:`, error);
      }
    }
  } catch (error) {
    console.warn(`Error calculating metrics for SKU ${sku}:`, error);
  }

  // Calculate derived metrics
  const returnRate = totalSold > 0 ? (totalReturn * 100) / totalSold : 0;
  const avgSellingPrice = totalSold > 0 ? totalProductSoldAmount / totalSold : (productData.selling_price || 0);
  const qtyRequire = Math.max(0, last30DaysSold - stockTotal);
  
  // Determine product status
  const getProductStatus = (): 'Buyable' | 'Not Buyable' | 'Disable' => {
    if (stockTotal === 0) return 'Disable';
    if (stockTotal < 5) return 'Not Buyable';
    return 'Buyable';
  };

  return {
    avgSellingPrice: Math.round(avgSellingPrice * 100) / 100,
    totalSold,
    totalReturn,
    last30DaysSold,
    last30DaysReturn,
    daysSinceLastOrder: daysSinceLastOrder === 999 ? 999 : daysSinceLastOrder,
    returnRate: Math.round(returnRate * 100) / 100,
    qtyRequire,
    productStatus: getProductStatus(),
    lastCalculated: now,
    calculationVersion: '1.0'
  };
}

/**
 * Calculate metrics for all products in an integration
 */
export async function calculateAllProductMetrics(
  integrationId: string,
  onProgress?: (progress: CalculationProgress) => void
): Promise<{ success: number; errors: string[] }> {
  console.log('Starting bulk product metrics calculation...');
  
  // Get all products for this integration
  const offersQuery = query(
    collection(db, 'takealot_offers'),
    where('integrationId', '==', integrationId)
  );
  
  const offersSnapshot = await getDocs(offersQuery);
  const totalProducts = offersSnapshot.size;
  
  if (totalProducts === 0) {
    throw new Error('No products found for this integration');
  }

  console.log(`Found ${totalProducts} products to process`);
  
  let processed = 0;
  let successCount = 0;
  const errors: string[] = [];
  
  // Process in batches to avoid overwhelming Firestore
  const BATCH_SIZE = 500; // Firestore batch limit
  let batch = writeBatch(db);
  let batchOperations = 0;
  
  for (const productDoc of offersSnapshot.docs) {
    try {
      const productData = productDoc.data();
      const sku = productData.sku || productData.product_label_number || 'Unknown';
      
      // Report progress
      if (onProgress) {
        onProgress({
          processed,
          total: totalProducts,
          currentProduct: sku,
          errors
        });
      }
      
      // Calculate metrics for this product
      const metrics = await calculateProductMetrics(integrationId, productData);
      
      // Add to batch update
      const productRef = doc(db, 'takealot_offers', productDoc.id);
      batch.update(productRef, { calculatedMetrics: metrics });
      batchOperations++;
      
      // Execute batch if it's full
      if (batchOperations >= BATCH_SIZE) {
        await batch.commit();
        console.log(`Committed batch of ${batchOperations} updates`);
        batch = writeBatch(db);
        batchOperations = 0;
      }
      
      successCount++;
    } catch (error) {
      const errorMsg = `Error processing product ${productDoc.id}: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
    
    processed++;
  }
  
  // Commit remaining operations
  if (batchOperations > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${batchOperations} updates`);
  }
  
  console.log(`Calculation complete. Success: ${successCount}, Errors: ${errors.length}`);
  
  return { success: successCount, errors };
}

/**
 * Get products with pre-calculated metrics
 */
export async function getProductsWithMetrics(integrationId: string): Promise<any[]> {
  const offersQuery = query(
    collection(db, 'takealot_offers'),
    where('integrationId', '==', integrationId)
  );
  
  const offersSnapshot = await getDocs(offersQuery);
  
  return offersSnapshot.docs.map(doc => {
    const data = doc.data();
    
    // Return product with metrics, fall back to empty metrics if not calculated
    return {
      ...data,
      id: doc.id,
      // Use pre-calculated metrics if available
      ...(data.calculatedMetrics || {}),
      // Ensure required fields exist
      avgSellingPrice: data.calculatedMetrics?.avgSellingPrice ?? data.selling_price ?? 0,
      totalSold: data.calculatedMetrics?.totalSold ?? 0,
      totalReturn: data.calculatedMetrics?.totalReturn ?? 0,
      last30DaysSold: data.calculatedMetrics?.last30DaysSold ?? 0,
      last30DaysReturn: data.calculatedMetrics?.last30DaysReturn ?? 0,
      daysSinceLastOrder: data.calculatedMetrics?.daysSinceLastOrder ?? 999,
      returnRate: data.calculatedMetrics?.returnRate ?? 0,
      qtyRequire: data.calculatedMetrics?.qtyRequire ?? 0,
      productStatus: data.calculatedMetrics?.productStatus ?? 'Not Buyable'
    };
  });
}

/**
 * Check if metrics need recalculation (older than X hours)
 */
export function needsRecalculation(lastCalculated: Date | null, maxAgeHours: number = 24): boolean {
  if (!lastCalculated) return true;
  
  const now = new Date();
  const ageInHours = (now.getTime() - lastCalculated.getTime()) / (1000 * 60 * 60);
  
  return ageInHours > maxAgeHours;
}
