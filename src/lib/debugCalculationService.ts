// src/lib/debugCalculationService.ts

import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import { processSaleRecordServer } from './tsinBasedCalculationServiceServer';

// Define a type for the detailed log entries
interface DebugLogEntry {
  step: string;
  details: string;
  data?: any;
  metrics_before?: any;
  metrics_after?: any;
}

// Define the structure for the final debug report
interface DebugReport {
  summary: {
    productId: string;
    integrationId: string;
    foundBy: 'TSIN' | 'SKU' | 'Not Found';
    initialData: any;
    finalMetrics: any;
  };
  logs: DebugLogEntry[];
}

/**
 * Traces the calculation for a single product and returns a detailed step-by-step log.
 * @param integrationId - The ID of the integration.
 * @param productId - The TSIN or SKU of the product to debug.
 * @returns A detailed debug report.
 */
export async function debugSingleProductCalculation(
  integrationId: string,
  productId: string
): Promise<DebugReport> {
  const logs: DebugLogEntry[] = [];
  let productData: any = null;
  let foundBy: 'TSIN' | 'SKU' | 'Not Found' = 'Not Found';

  logs.push({ step: 'Initiation', details: `Starting debug for Product ID: ${productId}, Integration ID: ${integrationId}` });

  // 1. Find the product in takealot_offers by TSIN or SKU
  try {
    // Try finding by TSIN first
    let productQuery = dbAdmin.collection('takealot_offers')
      .where('integrationId', '==', integrationId)
      .where('tsin_id', '==', productId);
    let productSnapshot = await productQuery.get();

    if (productSnapshot.empty) {
      // If not found by TSIN, try by SKU
      logs.push({ step: 'Product Search', details: `Product not found by TSIN, trying SKU.` });
      productQuery = dbAdmin.collection('takealot_offers')
        .where('integrationId', '==', integrationId)
        .where('sku', '==', productId);
      productSnapshot = await productQuery.get();
      if (!productSnapshot.empty) {
        productData = productSnapshot.docs[0].data();
        foundBy = 'SKU';
      }
    } else {
      productData = productSnapshot.docs[0].data();
      foundBy = 'TSIN';
    }

    if (!productData) {
      logs.push({ step: 'Product Search', details: 'Product not found in takealot_offers collection.', data: { productId } });
      return { summary: { productId, integrationId, foundBy: 'Not Found', initialData: null, finalMetrics: null }, logs };
    }
    logs.push({ step: 'Product Found', details: `Found product by ${foundBy}`, data: productData });

  } catch (error: any) {
    logs.push({ step: 'Error: Product Search', details: `Failed to fetch product: ${error.message}`, data: { error } });
    return { summary: { productId, integrationId, foundBy: 'Not Found', initialData: null, finalMetrics: null }, logs };
  }

  // 2. Initialize metrics and constants
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const stockTotal = productData.stock_at_takealot_total || 0;
  const stockOnWay = productData.total_stock_on_way || 0;
  const defaultPrice = productData.selling_price || 0;

  const metrics = {
    totalSold: 0,
    totalReturn: 0,
    last30DaysSold: 0,
    last30DaysReturn: 0,
    daysSinceLastOrder: 999,
    totalProductSoldAmount: 0,
  };

  logs.push({
    step: 'Initialization',
    details: 'Metrics object initialized.',
    data: {
      now: now.toISOString(),
      thirtyDaysAgo: thirtyDaysAgo.toISOString(),
      stockTotal,
      stockOnWay,
      initialMetrics: { ...metrics }
    }
  });

  // 3. Fetch all sales data for the product
  let salesRecords: any[] = [];
  try {
    const salesQuery = dbAdmin.collection('takealot_sales')
      .where('integrationId', '==', integrationId)
      .where(foundBy === 'TSIN' ? 'tsin_id' : 'sku', '==', productId);

    const salesSnapshot = await salesQuery.get();
    salesSnapshot.forEach(doc => salesRecords.push(doc.data()));

    logs.push({ step: 'Sales Data Fetch', details: `Found ${salesRecords.length} sales records.` });
    if (salesRecords.length === 0) {
        logs.push({ step: 'Sales Data Fetch', details: 'No sales records found. Calculation will be based on offer data only.' });
    }

  } catch (error: any) {
    logs.push({ step: 'Error: Sales Data Fetch', details: `Failed to fetch sales data: ${error.message}`, data: { error } });
    // Continue without sales data to calculate other metrics
  }

  // 4. Process each sale record
  salesRecords.forEach((sale, index) => {
    const metricsBefore = { ...metrics };
    logs.push({
      step: `Processing Sale Record ${index + 1}`,
      details: 'Processing a single sale/return record.',
      data: sale,
      metrics_before: metricsBefore,
    });

    processSaleRecordServer(sale, metrics, now, thirtyDaysAgo, defaultPrice);

    const metricsAfter = { ...metrics };
    logs.push({
      step: `Finished Processing Sale Record ${index + 1}`,
      details: 'Metrics updated after processing sale record.',
      metrics_after: metricsAfter,
    });
  });

  // 5. Calculate final derived metrics
  logs.push({ step: 'Final Calculation', details: 'Calculating derived metrics.' });
  const returnRate = metrics.totalSold > 0 ? (metrics.totalReturn * 100) / metrics.totalSold : 0;
  const avgSellingPrice = metrics.totalSold > 0 ? metrics.totalProductSoldAmount / metrics.totalSold : defaultPrice;
  const qtyRequire = Math.max(0, metrics.last30DaysSold - stockTotal - stockOnWay);

  const getProductStatus = (): 'Buyable' | 'Not Buyable' | 'Disable' => {
    const lowerOfferStatus = (productData.status || '').toLowerCase();
    if (lowerOfferStatus.includes('disabled')) return 'Disable';
    if (lowerOfferStatus.includes('not buyable')) return 'Not Buyable';
    if (lowerOfferStatus.includes('buyable')) return 'Buyable';
    if (stockTotal === 0) return 'Disable';
    if (stockTotal < 5) return 'Not Buyable';
    return 'Buyable';
  };
  const productStatus = getProductStatus();

  const finalMetrics = {
    totalSold: metrics.totalSold,
    totalReturn: metrics.totalReturn,
    last30DaysSold: metrics.last30DaysSold,
    last30DaysReturn: metrics.last30DaysReturn,
    daysSinceLastOrder: metrics.daysSinceLastOrder,
    totalProductSoldAmount: metrics.totalProductSoldAmount,
    returnRate: Math.round(returnRate * 100) / 100,
    avgSellingPrice: Math.round(avgSellingPrice * 100) / 100,
    qtyRequire,
    productStatus,
    lastCalculated: now,
    calculationVersion: `debug-${new Date().toISOString()}`
  };

  logs.push({ step: 'Final Metrics', details: 'Final metrics calculated.', data: finalMetrics });

  return {
    summary: {
      productId,
      integrationId,
      foundBy,
      initialData: productData,
      finalMetrics,
    },
    logs,
  };
}
