// src/lib/productMetricsCalculatorServer.ts

import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

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
  lastCalculated: Timestamp;
  calculationVersion: string;
}

interface CalculationProgress {
  processed: number;
  total: number;
  currentProduct: string;
  errors: string[];
}

/**
 * Calculate metrics for a single product using Firebase Admin SDK
 * Optimized version with performance improvements
 */
export async function calculateProductMetricsServer(
  integrationId: string, 
  productData: any
): Promise<ProductMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Use TSIN_ID as primary identifier for calculations
  const tsinId = productData.tsin_id;
  const sku = productData.sku || productData.product_label_number || 'N/A';
  const stockTotal = productData.stock_at_takealot_total || productData.stock || 0;
  const stockOnWay = productData.total_stock_on_way || productData.stock_on_way || 0;

  // Initialize metrics with better defaults
  let totalSold = 0;
  let totalReturn = 0;
  let last30DaysSold = 0;
  let last30DaysReturn = 0;
  let daysSinceLastOrder = 999;
  let totalProductSoldAmount = 0;
  try {
    // Get sales data from multiple possible collections
    const salesCollections = ['takealot_sales']; // Use only the correct Takealot API data collection
      if (!tsinId) {
      console.warn(`No TSIN ID found for product SKU: ${sku}`);
      
      // Determine product status based on stock and sales
      const getProductStatusEarly = (): 'Buyable' | 'Not Buyable' | 'Disable' => {
        // Use existing status from API if available
        const currentStatus = productData.status || '';
        if (currentStatus.toLowerCase().includes('disable')) return 'Disable';
        if (currentStatus.toLowerCase().includes('not') && currentStatus.toLowerCase().includes('buyable')) return 'Not Buyable';
        if (currentStatus.toLowerCase().includes('buyable')) return 'Buyable';
        
        // Fallback logic based on stock
        if (stockTotal === 0) return 'Disable';
        if (stockTotal < 5) return 'Not Buyable';
        return 'Buyable';
      };
      
      return {
        avgSellingPrice: productData.selling_price || 0,
        totalSold: 0,
        totalReturn: 0,
        last30DaysSold: 0,
        last30DaysReturn: 0,
        daysSinceLastOrder: 999,
        returnRate: 0,
        qtyRequire: 0,
        productStatus: getProductStatusEarly(),
        lastCalculated: Timestamp.now(),
        calculationVersion: '1.2'
      };
    }
    
    for (const collectionName of salesCollections) {
      try {
        // Query by TSIN_ID instead of SKU for more accurate matching
        const salesSnapshot = await dbAdmin
          .collection(collectionName)
          .where('integrationId', '==', integrationId)
          .where('tsin_id', '==', tsinId)
          .get();
        
        salesSnapshot.forEach(saleDoc => {
          const sale = saleDoc.data();
          const quantity = sale.quantity || sale.quantity_sold || sale.units_sold || 1;
          const orderDate = sale.order_date || sale.sale_date;
          const salePrice = sale.selling_price || sale.unit_price || sale.price || productData.selling_price || 0;
          
          if (orderDate) {
            let saleDate: Date;
            
            // Handle different date formats
            if (orderDate instanceof Timestamp) {
              saleDate = orderDate.toDate();
            } else if (typeof orderDate === 'string') {
              saleDate = new Date(orderDate);
            } else if (orderDate.seconds) {
              saleDate = new Date(orderDate.seconds * 1000);
            } else {
              saleDate = new Date(orderDate);
            }
            
            if (!isNaN(saleDate.getTime())) {
              // Calculate days since last order
              const daysDiff = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysDiff < daysSinceLastOrder) {
                daysSinceLastOrder = daysDiff;
              }              // Enhanced return detection logic - covers all return scenarios including "Returned" status
              const isReturn = sale.is_return || 
                             sale.return_status === 'returned' ||
                             sale.return_status === 'refunded' ||
                             (sale.order_status && sale.order_status.toLowerCase().includes('return')) ||
                             (sale.status && (
                               sale.status.toLowerCase().includes('return') ||
                               sale.status.toLowerCase().includes('refund') ||
                               sale.status.toLowerCase() === 'cancelled' ||
                               sale.status.toLowerCase() === 'returned' ||  // Specifically handle "Returned" status
                               sale.status === 'Returned'  // Case-sensitive match for "Returned"
                             )) ||
                             quantity < 0 ||
                             (sale.returns && Array.isArray(sale.returns) && sale.returns.length > 0 && sale.returns.some(r => r.quantity_returned > 0));
              
              if (isReturn) {
                const returnQty = Math.abs(quantity);
                totalReturn += returnQty;
                if (saleDate >= thirtyDaysAgo) {
                  last30DaysReturn += returnQty;
                }
              } else {
                // Regular sale
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
    }  } catch (error) {
    console.warn(`Error calculating metrics for TSIN ${tsinId} / SKU ${sku}:`, error);
  }

  // Determine product status based on stock and sales
  const getProductStatus = (): 'Buyable' | 'Not Buyable' | 'Disable' => {
    // Use existing status from API if available
    const currentStatus = productData.status || '';
    if (currentStatus.toLowerCase().includes('disable')) return 'Disable';
    if (currentStatus.toLowerCase().includes('not') && currentStatus.toLowerCase().includes('buyable')) return 'Not Buyable';
    if (currentStatus.toLowerCase().includes('buyable')) return 'Buyable';
    
    // Fallback logic based on stock
    if (stockTotal === 0) return 'Disable';
    if (stockTotal < 5) return 'Not Buyable';
    return 'Buyable';
  };

  // Calculate derived metrics with improved formulas
  const returnRate = totalSold > 0 ? (totalReturn * 100) / totalSold : 0;
  const avgSellingPrice = totalSold > 0 ? totalProductSoldAmount / totalSold : (productData.selling_price || 0);
  
  // Updated Qty Require formula: 30 Days sold - Stock on way - Available Stock At takealot
  const qtyRequire = Math.max(0, last30DaysSold - stockOnWay - stockTotal);
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
    lastCalculated: Timestamp.now(),
    calculationVersion: '1.2'
  };
}

/**
 * Calculate metrics for all products in an integration using Firebase Admin SDK
 */
export async function calculateAllProductMetricsServer(
  integrationId: string,
  onProgress?: (progress: CalculationProgress) => void
): Promise<{ success: number; errors: string[] }> {
  console.log('Starting bulk product metrics calculation (server-side)...');
  
  // Try both collection names for products
  let offersSnapshot: FirebaseFirestore.QuerySnapshot;
  let collectionUsed = '';
  
  try {
    // Try takealot_offers first
    offersSnapshot = await dbAdmin
      .collection('takealot_offers')
      .where('integrationId', '==', integrationId)
      .get();
    collectionUsed = 'takealot_offers';
  } catch (error) {
    console.warn('Could not query takealot_offers, trying takealotProducts...', error);
    try {
      offersSnapshot = await dbAdmin
        .collection('takealotProducts')
        .where('integrationId', '==', integrationId)
        .get();
      collectionUsed = 'takealotProducts';
    } catch (error2) {
      throw new Error('Could not access product collections');
    }
  }
  
  const totalProducts = offersSnapshot.size;
  
  if (totalProducts === 0) {
    throw new Error('No products found for this integration');
  }
  console.log(`Found ${totalProducts} products to process in ${collectionUsed}`);
  
  let processed = 0;
  let successCount = 0;
  const errors: string[] = [];
    // Process in smaller batches for better performance and memory management
  const BATCH_SIZE = 50; // Reduced from 100 for even faster processing
  const PROGRESS_BATCH_SIZE = 5; // Report progress every 5 products for better feedback
  let batch = dbAdmin.batch();
  let batchOperations = 0;
  
  for (const productDoc of offersSnapshot.docs) {
    try {
      const productData = productDoc.data();
      const sku = productData.sku || productData.product_label_number || 'Unknown';
      
      // Report progress more frequently for better user feedback
      if (processed % PROGRESS_BATCH_SIZE === 0 && onProgress) {
        onProgress({
          processed,
          total: totalProducts,
          currentProduct: sku,
          errors
        });
      }
      
      // Calculate metrics for this product
      const metrics = await calculateProductMetricsServer(integrationId, productData);
      
      // Update the product document with calculated metrics
      const productRef = dbAdmin.collection(collectionUsed).doc(productDoc.id);
      
      // Optimized update data structure
      const updateData = {
        // Individual fields for easy querying (only essential fields)
        totalSold: metrics.totalSold,
        totalReturn: metrics.totalReturn,
        last30DaysSold: metrics.last30DaysSold,
        last30DaysReturn: metrics.last30DaysReturn,
        returnRate: metrics.returnRate,
        qtyRequire: metrics.qtyRequire,
        avgSellingPrice: metrics.avgSellingPrice,
        daysSinceLastOrder: metrics.daysSinceLastOrder,
        productStatus: metrics.productStatus,
        // Compact metadata
        lastUpdated: Timestamp.now(),
        metricsLastCalculated: Timestamp.now(),
        calculationVersion: '1.2'
      };
      
      batch.update(productRef, updateData);
      batchOperations++;
      
      // Execute batch when it reaches the limit
      if (batchOperations >= BATCH_SIZE) {
        await batch.commit();
        console.log(`Committed batch of ${batchOperations} updates (${processed + 1}/${totalProducts})`);
        batch = dbAdmin.batch();
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
 * Get products with pre-calculated metrics using Firebase Admin SDK
 */
export async function getProductsWithMetricsServer(integrationId: string): Promise<any[]> {
  // Try both collection names
  let offersSnapshot: FirebaseFirestore.QuerySnapshot;
  
  try {
    offersSnapshot = await dbAdmin
      .collection('takealot_offers')
      .where('integrationId', '==', integrationId)
      .get();
  } catch (error) {
    console.warn('Could not query takealot_offers, trying takealotProducts...', error);
    offersSnapshot = await dbAdmin
      .collection('takealotProducts')
      .where('integrationId', '==', integrationId)
      .get();
  }
  
  return offersSnapshot.docs.map(doc => {
    const data = doc.data();
    
    // Return product with metrics, fall back to empty metrics if not calculated
    return {
      ...data,
      id: doc.id,
      // Use pre-calculated metrics if available (individual fields take precedence)
      avgSellingPrice: data.avgSellingPrice ?? data.calculatedMetrics?.avgSellingPrice ?? data.selling_price ?? 0,
      totalSold: data.totalSold ?? data.calculatedMetrics?.totalSold ?? 0,
      totalReturn: data.totalReturn ?? data.calculatedMetrics?.totalReturn ?? 0,
      last30DaysSold: data.last30DaysSold ?? data.calculatedMetrics?.last30DaysSold ?? 0,
      last30DaysReturn: data.last30DaysReturn ?? data.calculatedMetrics?.last30DaysReturn ?? 0,
      daysSinceLastOrder: data.daysSinceLastOrder ?? data.calculatedMetrics?.daysSinceLastOrder ?? 999,
      returnRate: data.returnRate ?? data.calculatedMetrics?.returnRate ?? 0,
      qtyRequire: data.qtyRequire ?? data.calculatedMetrics?.qtyRequire ?? 0,
      productStatus: data.productStatus ?? data.calculatedMetrics?.productStatus ?? data.status ?? 'Not Buyable'
    };
  });
}
