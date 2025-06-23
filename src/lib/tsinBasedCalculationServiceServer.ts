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

  // Use TSIN as primary identifier, fallback to SKU only if TSIN is missing
  const tsinId = productData.tsin_id;
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
    if (tsinId) {
      // Primary calculation using TSIN (most reliable)
      await calculateMetricsByTsinServer(integrationId, tsinId, {
        totalSold, totalReturn, last30DaysSold, last30DaysReturn, 
        daysSinceLastOrder, totalProductSoldAmount
      }, now, thirtyDaysAgo, productData.selling_price || 0);
    } else if (sku && sku !== 'N/A') {
      // Fallback to SKU calculation only if TSIN is missing
      console.warn(`No TSIN found for product, using SKU fallback: ${sku}`);
      await calculateMetricsBySkuServer(integrationId, sku, {
        totalSold, totalReturn, last30DaysSold, last30DaysReturn, 
        daysSinceLastOrder, totalProductSoldAmount
      }, now, thirtyDaysAgo, productData.selling_price || 0);
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
    calculationVersion: '2.0-TSIN'
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
          
          break; // Found data, move to next collection
        }
      }
    } catch (error) {
      console.warn(`Could not query collection ${collectionName} for TSIN:`, error);
    }
  }
}

/**
 * Calculate metrics using SKU (FALLBACK METHOD) - SERVER-SIDE
 */
async function calculateMetricsBySkuServer(
  integrationId: string,
  sku: string,
  metrics: any,
  now: Date,
  thirtyDaysAgo: Date,
  defaultPrice: number
) {
  const salesCollections = ['takealot_sales']; // Use only the correct Takealot API data collection
  
  for (const collectionName of salesCollections) {
    try {
      const skuQuery = dbAdmin.collection(collectionName)
        .where('integrationId', '==', integrationId)
        .where('sku', '==', sku);
      
      const salesSnapshot = await skuQuery.get();
      
      if (salesSnapshot.size > 0) {
        console.log(`Found ${salesSnapshot.size} sales records for SKU ${sku} in ${collectionName}`);
        
        salesSnapshot.forEach(saleDoc => {
          const sale = saleDoc.data();
          processSaleRecordServer(sale, metrics, now, thirtyDaysAgo, defaultPrice);
        });
        
        break; // Found data, move to next collection
      }
    } catch (error) {
      console.warn(`Could not query collection ${collectionName} for SKU:`, error);
    }
  }
}

/**
 * Process individual sale record and update metrics - SERVER-SIDE
 */
function processSaleRecordServer(
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
 * FAST BATCH CALCULATION FOR ALL PRODUCTS - SERVER-SIDE
 * Uses optimized parallel processing with TSIN prioritization
 */
export async function calculateAllProductsWithTsinServer(
  integrationId: string,
  onProgress?: (progress: { processed: number; total: number; currentProduct: string }) => void
): Promise<{ success: number; errors: string[] }> {
  console.log(`[TSIN CALC] Starting TSIN-based calculation for integration: ${integrationId}`);
  
  // Get all products for this integration using Firebase Admin
  const offersQuery = dbAdmin.collection('takealot_offers')
    .where('integrationId', '==', integrationId);
    const offersSnapshot = await offersQuery.get();
  const products = offersSnapshot.docs; // Get the actual documents
  const totalProducts = products.length;
  
  if (totalProducts === 0) {
    throw new Error('No products found for this integration');
  }

  console.log(`Found ${totalProducts} products to process with TSIN-based calculations`);
  
  const BATCH_SIZE = 50;
  const CONCURRENT_CALCULATIONS = 5;
  
  let successCount = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    console.log(`[TSIN CALC] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)}`);
    
    const batch = products.slice(i, i + BATCH_SIZE);
    const batchOperations: any[] = [];
    
    // Process products in parallel within each batch
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
          const metrics = await calculateTsinBasedMetricsServer(integrationId, productData);
            // Prepare batch update - Save metrics both in nested object AND root level for live data
          batchOperations.push({
            doc: productDoc.ref,
            data: {
              // Root level fields for live data access
              total_sold: metrics.totalSold,
              total_return: metrics.totalReturn,
              last_30_days_sold: metrics.last30DaysSold,
              last_30_days_return: metrics.last30DaysReturn,
              days_since_last_order: metrics.daysSinceLastOrder,
              return_rate: metrics.returnRate,
              quantity_required: metrics.qtyRequire,
              product_status: metrics.productStatus,
              avg_selling_price: metrics.avgSellingPrice,
              
              // Nested object for detailed metrics tracking
              tsinCalculatedMetrics: metrics,
              lastTsinCalculation: new Date(),
              calculationMethod: 'TSIN-based',
              calculationVersion: '2.0-TSIN'
            }
          });
          
          return { success: true, id: productDoc.id };
        } catch (error) {
          const errorMsg = `Error processing product ${productDoc.id}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
          return { success: false, id: productDoc.id };
        }
      });
      
      const batchResults = await Promise.all(concurrentPromises);
      successCount += batchResults.filter(r => r.success).length;
    }
    
    // Commit the batch using Firebase Admin
    if (batchOperations.length > 0) {
      try {
        const writeBatch = dbAdmin.batch();
        
        batchOperations.forEach(operation => {
          console.log(`[TSIN CALC] Adding update for product: ${operation.data.total_sold} sold, ${operation.data.product_status} status`);
          writeBatch.update(operation.doc, operation.data);
        });
        
        await writeBatch.commit();
        console.log(`[TSIN CALC] ✅ Successfully committed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)} with ${batchOperations.length} updates`);
      } catch (commitError) {
        console.error('[TSIN CALC] ❌ Error committing batch:', commitError);
        errors.push(`Batch commit error: ${commitError}`);
      }
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < products.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`[TSIN CALC] 🎉 TSIN-based calculation complete. Success: ${successCount}, Errors: ${errors.length}`);
  
  return { success: successCount, errors };
}
