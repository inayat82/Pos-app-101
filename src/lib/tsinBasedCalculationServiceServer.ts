// src/lib/tsinBasedCalculationServiceServer.ts

import { dbAdmin } from '@/lib/firebase/firebaseAdmin';

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
}

interface SalesData {
  tsin_id?: string;
  tsin?: string;
  sku?: string;
  quantity?: number;
  quantity_sold?: number;
  units_sold?: number;
  order_date?: string;
  sale_date?: string;
  created_at?: any;
  status?: string;
  order_status?: string;
  return_status?: string;
  is_return?: boolean;
  selling_price?: number;
  price?: number;
  [key: string]: any;
}

/**
 * SERVER-SIDE TSIN-BASED CALCULATION SERVICE
 * This service uses Firebase Admin SDK for server-side operations
 */

/**
 * Calculate metrics for a single product using TSIN as primary identifier (SERVER-SIDE)
 */
export async function calculateTsinBasedMetricsServer(
  integrationId: string,
  productData: any
): Promise<TsinProductMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Use TSIN as primary identifier. SKU fallback has been removed as it is unreliable.
  const tsinId = productData.tsin_id;
  const stockTotal = productData.stock_at_takealot_total || 0;
  const stockOnWay = productData.total_stock_on_way || 0;

  // Initialize metrics as an object to be passed by reference
  const metrics = {
    totalSold: 0,
    totalReturn: 0,
    last30DaysSold: 0,
    last30DaysReturn: 0,
    daysSinceLastOrder: 999,
    totalProductSoldAmount: 0,
  };

  try {
    if (tsinId) {
      // Primary calculation using TSIN (most reliable)
      await calculateMetricsByTsinServer(integrationId, tsinId, metrics, now, thirtyDaysAgo, productData.selling_price || 0);
    } else {
        // If no TSIN, we cannot calculate metrics reliably.
        console.warn(`No TSIN found for product, skipping sales calculation. Product data:`, productData);
    }
  } catch (error) {
    console.warn(`Error calculating metrics for TSIN ${tsinId}:`, error);
  }

  // Calculate derived metrics from the mutated metrics object
  const returnRate = metrics.totalSold > 0 ? (metrics.totalReturn * 100) / metrics.totalSold : 0;
  const avgSellingPrice = metrics.totalSold > 0 ? metrics.totalProductSoldAmount / metrics.totalSold : (productData.selling_price || 0);
  const qtyRequire = Math.max(0, metrics.last30DaysSold - stockTotal - stockOnWay);
  
  // Determine product status
  const getProductStatus = (): 'Buyable' | 'Not Buyable' | 'Disable' => {
    const lowerOfferStatus = (productData.status || '').toLowerCase();
    
    // Prioritize the status from the Takealot API response
    if (lowerOfferStatus.includes('disabled by seller') || lowerOfferStatus.includes('disabled by takealot') || lowerOfferStatus.includes('disable')) {
      return 'Disable';
    }
    if (lowerOfferStatus.includes('not buyable')) {
      return 'Not Buyable';
    }
    if (lowerOfferStatus.includes('buyable')) {
      return 'Buyable';
    }
    
    // Fallback to stock-based logic if the API status isn't clear
    if (stockTotal === 0) return 'Disable';
    if (stockTotal < 5) return 'Not Buyable';
    return 'Buyable';
  };

  return {
    avgSellingPrice: Math.round(avgSellingPrice * 100) / 100,
    totalSold: metrics.totalSold,
    totalReturn: metrics.totalReturn,
    last30DaysSold: metrics.last30DaysSold,
    last30DaysReturn: metrics.last30DaysReturn,
    daysSinceLastOrder: metrics.daysSinceLastOrder === 999 ? 999 : metrics.daysSinceLastOrder,
    returnRate: Math.round(returnRate * 100) / 100,
    qtyRequire,
    productStatus: getProductStatus(),
    lastCalculated: now,
    calculationVersion: '2.6-sku-fallback-removed'
  };
}

/**
 * Calculate metrics using TSIN (PRIMARY METHOD) - SERVER-SIDE
 */
async function calculateMetricsByTsinServer(
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
      // Query by TSIN ID using Firebase Admin
      const tsinQuery1 = dbAdmin.collection(collectionName)
        .where('integrationId', '==', integrationId)
        .where('tsin_id', '==', tsinId);
      
      const tsinQuery2 = dbAdmin.collection(collectionName)
        .where('integrationId', '==', integrationId)
        .where('tsin', '==', tsinId);

      const queries = [tsinQuery1, tsinQuery2];

      for (const tsinQuery of queries) {
        const salesSnapshot = await tsinQuery.get();
        
        if (salesSnapshot.size > 0) {
          console.log(`Found ${salesSnapshot.size} sales records for TSIN ${tsinId} in ${collectionName}`);
          
          salesSnapshot.forEach(saleDoc => {
            const sale = saleDoc.data();
            processSaleRecordServer(sale, metrics, now, thirtyDaysAgo, defaultPrice);
          });
          
          return; // Data found and processed, exit the function.
        }
      }
    } catch (error) {
      console.error(`[TSIN CALC DEBUG] FATAL: Error querying ${collectionName} for TSIN ${tsinId}:`, error);
      // Re-throw the error to be caught by the main batch processor
      throw new Error(`Firestore query failed for TSIN ${tsinId} in ${collectionName}`);
    }
  }
}

/**
 * Process individual sale record and update metrics - SERVER-SIDE
 */
export function processSaleRecordServer(
  sale: SalesData,
  metrics: any,
  now: Date,
  thirtyDaysAgo: Date,
  defaultPrice: number
) {
  const quantity = sale.quantity || sale.quantity_sold || sale.units_sold || 1;
  const orderDate = sale.order_date || sale.sale_date || sale.created_at;
  const salePrice = sale.selling_price || sale.price || defaultPrice;
  
  if (orderDate) {
    // Robust date handling for both string and Firestore Timestamp
    const saleDate = (orderDate.toDate && typeof orderDate.toDate === 'function')
      ? orderDate.toDate()
      : new Date(orderDate);

    if (!isNaN(saleDate.getTime())) {
      // Calculate days since last order, only if the sale is not in the future
      const daysDiff = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff < metrics.daysSinceLastOrder) {
        metrics.daysSinceLastOrder = daysDiff;
      }
      
      // Expanded check for returns, including looking at the general 'status' field
      const isReturn = sale.is_return === true || 
                     (sale.return_status && sale.return_status.length > 0) || 
                     (sale.order_status && sale.order_status.toLowerCase().includes('return')) ||
                     (sale.status && sale.status.toLowerCase().includes('return')) ||
                     (quantity < 0);
      
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
 * FAST BATCH CALCULATION FOR ALL PRODUCTS - SERVER-SIDE
 * Uses optimized parallel processing with TSIN prioritization
 */
export async function calculateAllProductsWithTsinServer(
  integrationId: string,
  onProgress?: (progress: { processed: number; total: number; currentProduct: string }) => void
): Promise<{ success: number; errors: string[] }> {
  console.log(`[TSIN CALC DEBUG] Service invoked for integration: ${integrationId}`);
  
  let offersSnapshot;
  try {
    const offersQuery = dbAdmin.collection('takealot_offers')
      .where('integrationId', '==', integrationId);
    offersSnapshot = await offersQuery.get();
    console.log(`[TSIN CALC DEBUG] Successfully fetched ${offersSnapshot.docs.length} products from Firestore.`);
  } catch (error) {
    console.error('[TSIN CALC DEBUG] FATAL: Could not fetch products from Firestore.', error);
    throw new Error('Failed to fetch products. Check Firestore permissions and query.');
  }
  
  const products = offersSnapshot.docs;
  const totalProducts = products.length;
  
  if (totalProducts === 0) {
    console.warn(`[TSIN CALC DEBUG] No products found for integration ${integrationId}. Aborting.`);
    // Return success with 0 processed instead of throwing an error
    return { success: 0, errors: ['No products found for this integration'] };
  }

  console.log(`[TSIN CALC DEBUG] Found ${totalProducts} products to process.`);
  
  const BATCH_SIZE = 50;
  let successCount = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const batchOperations: any[] = [];
    
    const calculationPromises = batch.map(async (productDoc) => {
      try {
        const productData = productDoc.data();
        const metrics = await calculateTsinBasedMetricsServer(integrationId, productData);
        
        batchOperations.push({
          doc: productDoc.ref,
          data: {
            total_sold: metrics.totalSold,
            total_return: metrics.totalReturn,
            last_30_days_sold: metrics.last30DaysSold,
            last_30_days_return: metrics.last30DaysReturn,
            days_since_last_order: metrics.daysSinceLastOrder,
            return_rate: metrics.returnRate,
            quantity_required: metrics.qtyRequire,
            product_status: metrics.productStatus,
            avg_selling_price: metrics.avgSellingPrice,
            tsinCalculatedMetrics: metrics,
            lastTsinCalculation: new Date(),
            calculationMethod: 'TSIN-based',
            calculationVersion: '2.6-sku-fallback-removed'
          }
        });
        return { success: true };
      } catch (error) {
        const errorMsg = `Error processing product ${productDoc.id}: ${error}`;
        errors.push(errorMsg);
        console.error(`[TSIN CALC DEBUG] ${errorMsg}`);
        return { success: false };
      }
    });
      
    const results = await Promise.all(calculationPromises);
    successCount += results.filter(r => r.success).length;
    
    if (batchOperations.length > 0) {
      try {
        const writeBatch = dbAdmin.batch();
        batchOperations.forEach(op => writeBatch.update(op.doc, op.data));
        await writeBatch.commit();
        console.log(`[TSIN CALC DEBUG] Successfully committed batch with ${batchOperations.length} updates.`);
      } catch (commitError) {
        console.error('[TSIN CALC DEBUG] FATAL: Error committing batch:', commitError);
        errors.push(`Batch commit error: ${commitError}`);
      }
    }
    
    if (onProgress) {
        onProgress({
            processed: Math.min(i + BATCH_SIZE, totalProducts),
            total: totalProducts,
            currentProduct: 'Batch complete'
        });
    }
  }
  
  console.log(`[TSIN CALC DEBUG] Calculation complete. Success: ${successCount}, Errors: ${errors.length}`);
  
  return { success: successCount, errors };
}
