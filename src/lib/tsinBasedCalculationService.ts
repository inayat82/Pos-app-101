// src/lib/tsinBasedCalculationService.ts

import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, doc, writeBatch, Timestamp } from 'firebase/firestore';

interface TsinProductMetrics {
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
  // Display fields (for UI purposes only, not used in calculations)
  tsinId?: string;
  sku?: string | null;
  displayInfo?: {
    productName: string;
    brand: string;
  };
}

interface SalesData {
  tsin_id?: string;
  tsin?: string;
  sku?: string; // For display only - NOT used for calculations or matching
  quantity?: number;
  quantity_sold?: number;
  units_sold?: number;
  order_date?: string;
  sale_date?: string;
  created_at?: Timestamp;
  status?: string;
  order_status?: string;
  return_status?: string;
  is_return?: boolean;
  selling_price?: number;
  price?: number;
  [key: string]: any;
}

/**
 * OPTIMIZED TSIN-BASED CALCULATION SERVICE
 * This service prioritizes TSIN for all calculations with fast batch processing
 */

/**
 * Calculate metrics for a single product using TSIN as primary identifier
 */
export async function calculateTsinBasedMetrics(
  integrationId: string,
  productData: any
): Promise<TsinProductMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Use TSIN as primary and only identifier for calculations (SKU kept for display only)
  const tsinId = productData.tsin_id;
  const sku = productData.sku || productData.product_label_number || 'N/A'; // For display only
  const stockTotal = productData.stock_at_takealot_total || 0;

  // Initialize metrics
  let totalSold = 0;
  let totalReturn = 0;
  let last30DaysSold = 0;
  let last30DaysReturn = 0;
  let daysSinceLastOrder = 999;
  let totalProductSoldAmount = 0;

  try {
    if (tsinId) {
      // Primary calculation using TSIN (most reliable)
      const metricsRef = {
        totalSold, totalReturn, last30DaysSold, last30DaysReturn, 
        daysSinceLastOrder, totalProductSoldAmount
      };
      
      await calculateMetricsByTsin(integrationId, tsinId, metricsRef, now, thirtyDaysAgo, productData.selling_price || 0);
      
      // Extract updated values
      totalSold = metricsRef.totalSold;
      totalReturn = metricsRef.totalReturn;
      last30DaysSold = metricsRef.last30DaysSold;
      last30DaysReturn = metricsRef.last30DaysReturn;
      daysSinceLastOrder = metricsRef.daysSinceLastOrder;
      totalProductSoldAmount = metricsRef.totalProductSoldAmount;
    } else {
      // No TSIN available - cannot calculate metrics reliably
      console.warn(`No TSIN found for product, skipping metrics calculation:`, productData);
      throw new Error('Product missing TSIN ID - cannot calculate metrics reliably');
    }
  } catch (error) {
    console.warn(`Error calculating metrics for TSIN ${tsinId}:`, error);
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
    // Core metrics (calculated using TSIN only)
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
    calculationVersion: '2.1-TSIN-ONLY',
    // Display information (SKU kept for UI display only)
    tsinId,
    sku: sku !== 'N/A' ? sku : null,
    displayInfo: {
      productName: productData.product_title || productData.title || 'Unknown Product',
      brand: productData.brand || 'Unknown Brand'
    }
  };
}

/**
 * Calculate metrics using TSIN (PRIMARY METHOD)
 */
async function calculateMetricsByTsin(
  integrationId: string,
  tsinId: string,
  metrics: any,
  now: Date,
  thirtyDaysAgo: Date,
  defaultPrice: number
) {
  const salesCollections = ['takealot_sales']; // Use only the correct Takealot API data collection
  
  for (const collectionName of salesCollections) {
    try {
      // Query by TSIN ID
      const tsinQueries = [
        query(
          collection(db, collectionName),
          where('integrationId', '==', integrationId),
          where('tsin_id', '==', tsinId)
        ),
        query(
          collection(db, collectionName),
          where('integrationId', '==', integrationId),
          where('tsin', '==', tsinId) // Alternative field name
        )
      ];

      for (const tsinQuery of tsinQueries) {
        const salesSnapshot = await getDocs(tsinQuery);
        
        if (salesSnapshot.size > 0) {
          console.log(`Found ${salesSnapshot.size} sales records for TSIN ${tsinId} in ${collectionName}`);
          
          salesSnapshot.forEach(saleDoc => {
            const sale = saleDoc.data();
            processSaleRecord(sale, metrics, now, thirtyDaysAgo, defaultPrice);
          });
          
          break; // Found data, move to next collection
        }
      }
    } catch (error) {
      console.warn(`Could not query collection ${collectionName} for TSIN:`, error);
    }
  }
}

/**
 * Process individual sale record and update metrics
 */
function processSaleRecord(
  sale: SalesData,
  metrics: any,
  now: Date,
  thirtyDaysAgo: Date,
  defaultPrice: number
) {
  const quantity = sale.quantity || sale.quantity_sold || sale.units_sold || 1;
  const orderDate = sale.order_date || sale.sale_date;
  const salePrice = sale.selling_price || sale.price || defaultPrice;
  
  if (orderDate) {
    const saleDate = new Date(orderDate);
    if (!isNaN(saleDate.getTime())) {
      // Calculate days since last order
      const daysDiff = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < metrics.daysSinceLastOrder) {
        metrics.daysSinceLastOrder = daysDiff;
      }
      
      // Check if it's a return
      const isReturn = sale.is_return || 
                     sale.return_status || 
                     (sale.order_status && sale.order_status.toLowerCase().includes('return')) ||
                     quantity < 0;
      
      if (isReturn) {
        const returnQty = Math.abs(quantity);
        metrics.totalReturn += returnQty;
        if (saleDate >= thirtyDaysAgo) {
          metrics.last30DaysReturn += returnQty;
        }
      } else {
        metrics.totalSold += quantity;
        metrics.totalProductSoldAmount += quantity * salePrice;
        if (saleDate >= thirtyDaysAgo) {
          metrics.last30DaysSold += quantity;
        }
      }
    }
  }
}

/**
 * FAST BATCH CALCULATION FOR ALL PRODUCTS
 * Uses optimized parallel processing with TSIN prioritization
 */
export async function calculateAllProductsWithTsin(
  integrationId: string,
  onProgress?: (progress: { processed: number; total: number; currentProduct: string }) => void
): Promise<{ success: number; errors: string[] }> {
  console.log('Starting optimized TSIN-based calculation...');
  
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

  console.log(`Found ${totalProducts} products to process with TSIN-based calculations`);
  
  let successCount = 0;
  const errors: string[] = [];
  
  // Process in optimized batches
  const BATCH_SIZE = 50; // Smaller batches for better performance
  const CONCURRENT_CALCULATIONS = 5; // Process 5 products in parallel
  
  const products = offersSnapshot.docs;
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const writeBatchOp = writeBatch(db);
    let batchOperations = 0;
    
    // Process products in parallel within each batch
    const batchPromises = [];
    
    for (let j = 0; j < batch.length; j += CONCURRENT_CALCULATIONS) {
      const concurrentBatch = batch.slice(j, j + CONCURRENT_CALCULATIONS);
      
      const concurrentPromises = concurrentBatch.map(async (productDoc) => {
        try {
          const productData = productDoc.data();
          const identifier = productData.tsin_id || productData.sku || 'Unknown';
          
          // Report progress
          if (onProgress) {
            onProgress({
              processed: i + j + concurrentBatch.indexOf(productDoc),
              total: totalProducts,
              currentProduct: identifier
            });
          }
            // Calculate metrics using TSIN-based approach
          const metrics = await calculateTsinBasedMetrics(integrationId, productData);
          
          // Add to batch update (with proper Firestore references)
          if (batchOperations < 500) { // Firestore batch limit
            const productRef = doc(db, 'takealot_offers', productDoc.id);
            writeBatchOp.update(productRef, { 
              tsinCalculatedMetrics: metrics,
              lastTsinCalculation: Timestamp.now(),
              calculationMethod: 'TSIN-based'
            });
            batchOperations++;
          }
          
          return { success: true, id: productDoc.id };
        } catch (error) {
          const errorMsg = `Error processing product ${productDoc.id}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
          return { success: false, id: productDoc.id };
        }
      });
      
      batchPromises.push(...concurrentPromises);
    }
    
    // Wait for all concurrent calculations in this batch
    const batchResults = await Promise.all(batchPromises);
    successCount += batchResults.filter(r => r.success).length;
    
    // Commit the batch if there are operations
    if (batchOperations > 0) {
      try {
        await writeBatchOp.commit();
        console.log(`Committed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)} with ${batchOperations} updates`);
      } catch (commitError) {
        console.error('Error committing batch:', commitError);
        errors.push(`Batch commit error: ${commitError}`);
      }
    }
    
    // Small delay between batches to avoid overwhelming Firestore
    if (i + BATCH_SIZE < products.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`TSIN-based calculation complete. Success: ${successCount}, Errors: ${errors.length}`);
  
  return { success: successCount, errors };
}

/**
 * Get products with TSIN-calculated metrics (optimized for reports)
 */
export async function getProductsWithTsinMetrics(integrationId: string): Promise<any[]> {
  const offersQuery = query(
    collection(db, 'takealot_offers'),
    where('integrationId', '==', integrationId)
  );
  
  const offersSnapshot = await getDocs(offersQuery);
  
  return offersSnapshot.docs.map(doc => {
    const data = doc.data();
    
    // Prioritize TSIN-calculated metrics, fallback to old metrics
    const metrics = data.tsinCalculatedMetrics || data.calculatedMetrics || {};
    
    return {
      ...data,
      id: doc.id,
      // Use TSIN-calculated metrics with fallbacks
      avgSellingPrice: metrics.avgSellingPrice ?? data.selling_price ?? 0,
      totalSold: metrics.totalSold ?? 0,
      totalReturn: metrics.totalReturn ?? 0,
      last30DaysSold: metrics.last30DaysSold ?? 0,
      last30DaysReturn: metrics.last30DaysReturn ?? 0,
      daysSinceLastOrder: metrics.daysSinceLastOrder ?? 999,
      returnRate: metrics.returnRate ?? 0,
      qtyRequire: metrics.qtyRequire ?? 0,
      productStatus: metrics.productStatus ?? 'Not Buyable',
      calculationMethod: data.calculationMethod || 'Legacy',
      lastCalculated: metrics.lastCalculated || null
    };
  });
}

/**
 * Check if TSIN-based recalculation is needed
 */
export function needsTsinRecalculation(lastCalculated: Date | null, maxAgeHours: number = 24): boolean {
  if (!lastCalculated) return true;
  
  const now = new Date();
  const ageInHours = (now.getTime() - lastCalculated.getTime()) / (1000 * 60 * 60);
  
  return ageInHours > maxAgeHours;
}
