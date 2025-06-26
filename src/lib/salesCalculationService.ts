// src/lib/salesCalculationService.ts

import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

interface SalesData {
  sku?: string;
  tsin_id?: string;
  product_sku?: string;
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
  [key: string]: any;
}

interface ProductSalesMetrics {
  totalSold: number;
  sold30Days: number;
  returned30Days: number;
  qtyRequire: number;
}

/**
 * Calculate sales metrics for a product based on sales data
 */
export async function calculateProductSalesMetrics(
  integrationId: string,
  productSku: string,
  productTsinId?: string,
  availableStock: number = 0
): Promise<ProductSalesMetrics> {
  try {
    console.log(`Calculating sales metrics for SKU: ${productSku}, TSIN: ${productTsinId}`);

    // Get current date and 30 days ago
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Try to get sales data from multiple collections
    const salesCollections = ['takealot_sales']; // Use only the correct Takealot API data collection
    const allSalesData: SalesData[] = [];

    for (const collectionName of salesCollections) {
      try {
        // Query by SKU
        if (productSku && productSku !== 'N/A') {
          const skuQueries = [
            query(
              collection(db, collectionName),
              where('integrationId', '==', integrationId),
              where('sku', '==', productSku)
            ),
            query(
              collection(db, collectionName),
              where('integrationId', '==', integrationId),
              where('product_sku', '==', productSku)
            )
          ];

          for (const skuQuery of skuQueries) {
            const snapshot = await getDocs(skuQuery);
            const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SalesData[];
            allSalesData.push(...salesData);
          }
        }

        // Query by TSIN if available
        if (productTsinId) {
          const tsinQuery = query(
            collection(db, collectionName),
            where('integrationId', '==', integrationId),
            where('tsin_id', '==', productTsinId)
          );

          const tsinSnapshot = await getDocs(tsinQuery);
          const tsinSalesData = tsinSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SalesData[];
          allSalesData.push(...tsinSalesData);
        }

        console.log(`Found ${allSalesData.length} sales records in ${collectionName}`);
      } catch (error) {
        console.warn(`Could not query collection ${collectionName}:`, error);
      }
    }

    // Remove duplicates based on order ID or unique identifier
    const uniqueSalesData = removeDuplicateSales(allSalesData);
    console.log(`After deduplication: ${uniqueSalesData.length} unique sales records`);

    // Calculate metrics
    const metrics = calculateMetricsFromSalesData(uniqueSalesData, thirtyDaysAgo, availableStock);
    
    console.log(`Sales metrics for ${productSku}:`, metrics);
    return metrics;

  } catch (error) {
    console.error('Error calculating product sales metrics:', error);
    return {
      totalSold: 0,
      sold30Days: 0,
      returned30Days: 0,
      qtyRequire: 0
    };
  }
}

/**
 * Remove duplicate sales records
 */
function removeDuplicateSales(salesData: SalesData[]): SalesData[] {
  const seen = new Set<string>();
  return salesData.filter(sale => {
    // Create unique identifier from multiple fields
    const identifier = `${sale.order_id || ''}_${sale.sale_id || ''}_${sale.sku || ''}_${sale.order_date || ''}_${sale.quantity || 0}`;
    if (seen.has(identifier)) {
      return false;
    }
    seen.add(identifier);
    return true;
  });
}

/**
 * Calculate metrics from sales data
 */
function calculateMetricsFromSalesData(
  salesData: SalesData[],
  thirtyDaysAgo: Date,
  availableStock: number
): ProductSalesMetrics {
  let totalSold = 0;
  let sold30Days = 0;
  let returned30Days = 0;

  for (const sale of salesData) {
    // Get quantity sold from various possible fields
    const quantity = getQuantityFromSale(sale);
    if (quantity <= 0) continue;

    // Determine if this is a return
    const isReturn = isReturnedSale(sale);

    // Get sale date
    const saleDate = getSaleDateFromRecord(sale);
    if (!saleDate) continue;

    // Calculate total sold (excluding returns)
    if (!isReturn) {
      totalSold += quantity;
    }

    // Check if sale is within last 30 days
    if (saleDate >= thirtyDaysAgo) {
      if (isReturn) {
        returned30Days += quantity;
      } else {
        sold30Days += quantity;
      }
    }
  }

  // Calculate quantity required: 30 days sold - available stock
  // This represents how much additional stock is needed based on recent sales trend
  const qtyRequire = Math.max(0, sold30Days - availableStock);

  return {
    totalSold,
    sold30Days,
    returned30Days,
    qtyRequire
  };
}

/**
 * Extract quantity from sale record
 */
function getQuantityFromSale(sale: SalesData): number {
  return sale.quantity || 
         sale.quantity_sold || 
         sale.units_sold || 
         1; // Default to 1 if no quantity field found
}

/**
 * Determine if a sale is a return
 */
function isReturnedSale(sale: SalesData): boolean {
  // Check various fields that might indicate a return
  if (sale.is_return === true) return true;
  if (sale.return_status && sale.return_status.toLowerCase() !== 'none') return true;
  if (sale.status && sale.status.toLowerCase().includes('return')) return true;
  if (sale.order_status && sale.order_status.toLowerCase().includes('return')) return true;
  
  // Check if quantity is negative (sometimes used to indicate returns)
  const quantity = getQuantityFromSale(sale);
  if (quantity < 0) return true;

  return false;
}

/**
 * Extract sale date from record
 */
function getSaleDateFromRecord(sale: SalesData): Date | null {
  // Try different date fields
  const dateString = sale.order_date || sale.sale_date;
  
  if (dateString) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try Timestamp fields
  if (sale.created_at && sale.created_at.toDate) {
    try {
      return sale.created_at.toDate();
    } catch (error) {
      console.warn('Error converting Timestamp to Date:', error);
    }
  }

  return null;
}

/**
 * Batch calculate sales metrics for multiple products
 */
export async function calculateBatchSalesMetrics(
  integrationId: string,
  products: Array<{ sku: string; tsin_id?: string; stock: number }>
): Promise<Map<string, ProductSalesMetrics>> {
  const metricsMap = new Map<string, ProductSalesMetrics>();
  const batchSize = 10; // Process 10 products at a time to avoid overwhelming Firestore

  console.log(`Calculating sales metrics for ${products.length} products in batches of ${batchSize}`);

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (product) => {
      const metrics = await calculateProductSalesMetrics(
        integrationId,
        product.sku,
        product.tsin_id,
        product.stock
      );
      return { sku: product.sku, metrics };
    });

    try {
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ sku, metrics }) => {
        metricsMap.set(sku, metrics);
      });

      console.log(`Completed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);
      
      // Add small delay between batches to be respectful to Firestore
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, error);
    }
  }

  return metricsMap;
}

/**
 * Get sales summary for admin dashboard
 */
export async function getSalesSummary(integrationId: string): Promise<{
  totalProducts: number;
  totalSales30Days: number;
  totalReturns30Days: number;
  averageSalesPerProduct: number;
  topSellingProducts: Array<{ sku: string; sold30Days: number }>;
}> {
  try {
    // This would be implemented to provide dashboard-level metrics
    // For now, return empty summary
    return {
      totalProducts: 0,
      totalSales30Days: 0,
      totalReturns30Days: 0,
      averageSalesPerProduct: 0,
      topSellingProducts: []
    };
  } catch (error) {
    console.error('Error getting sales summary:', error);
    throw error;
  }
}
