// src/lib/reportCacheService.ts

import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

interface CachedReportData {
  integrationId: string;
  reportType: string;
  data: any;
  timestamp: any; // Firestore Timestamp
  expiresAt: any; // Firestore Timestamp
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get cached report data if available and not expired
 */
export async function getCachedReportData(
  integrationId: string,
  reportType: string
): Promise<any | null> {
  try {
    const cacheKey = `${integrationId}_${reportType}`;
    const cacheDoc = doc(db, 'reportCache', cacheKey);
    const cacheSnapshot = await getDoc(cacheDoc);    if (cacheSnapshot.exists()) {
      const cachedData = cacheSnapshot.data() as CachedReportData;
      const now = new Date();
      
      // Handle both Date objects and Firestore Timestamps
      const expiresAt = cachedData.expiresAt?.toDate ? cachedData.expiresAt.toDate() : new Date(cachedData.expiresAt);
      
      if (expiresAt > now) {
        console.log(`Using cached data for ${reportType} report`);
        return cachedData.data;
      } else {
        console.log(`Cache expired for ${reportType} report`);
      }
    }

    return null;
  } catch (error) {
    console.error('Error retrieving cached report data:', error);
    return null;
  }
}

/**
 * Cache report data for future use
 */
export async function setCachedReportData(
  integrationId: string,
  reportType: string,
  data: any
): Promise<void> {
  try {
    const cacheKey = `${integrationId}_${reportType}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_DURATION);

    const cachedData: CachedReportData = {
      integrationId,
      reportType,
      data,
      timestamp: now,
      expiresAt
    };

    const cacheDoc = doc(db, 'reportCache', cacheKey);
    await setDoc(cacheDoc, cachedData);
    
    console.log(`Cached data for ${reportType} report, expires at:`, expiresAt);
  } catch (error) {
    console.error('Error caching report data:', error);
  }
}

/**
 * Get optimized product data for reports with all required fields
 * This function includes proper calculations for missing fields
 */
export async function getOptimizedProductData(integrationId: string) {
  try {
    // Check cache first
    const cachedData = await getCachedReportData(integrationId, 'product-performance');
    if (cachedData) {
      console.log('Returning cached data:', cachedData.length, 'items');
      return cachedData;
    }

    console.log('Loading comprehensive product data for reports...');

    // Load products with basic info
    const offersQuery = query(
      collection(db, 'takealot_offers'),
      where('integrationId', '==', integrationId)
    );
    
    const offersSnapshot = await getDocs(offersQuery);
    
    if (offersSnapshot.size === 0) {
      console.warn('No offers found for integration ID:', integrationId);
      return [];
    }

    // Get current date and 30 days ago for calculations
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);    // Process each product with comprehensive data
    const productDataPromises = offersSnapshot.docs.map(async (doc) => {
      const data = doc.data();
      const salesUnits = data.sales_units || [];
      const stockTotal = data.stock_at_takealot_total || 0;
      const sku = data.sku || data.product_label_number || 'N/A';
      const tsinId = data.tsin_id; // TSIN is now the primary identifier

      // Initialize sales metrics
      let totalSold = 0;
      let totalReturn = 0;
      let last30DaysSold = 0;
      let last30DaysReturn = 0;
      let daysSinceLastOrder = 999;
      let foundSalesData = false;

      // Try to get detailed sales data from sales collections
      // PRIORITIZE TSIN-BASED QUERIES FIRST
      try {
        const salesCollections = ['takealot_sales']; // Use only the correct Takealot API data collection
        
        for (const collectionName of salesCollections) {
          try {
            // PRIMARY: Query by TSIN if available (most reliable)
            if (tsinId) {
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
                  foundSalesData = true;
                  
                  salesSnapshot.forEach(saleDoc => {
                    const sale = saleDoc.data();
                    const quantity = sale.quantity || sale.quantity_sold || sale.units_sold || 1;
                    const orderDate = sale.order_date || sale.sale_date;
                    
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
                          totalReturn += Math.abs(quantity);
                          if (saleDate >= thirtyDaysAgo) {
                            last30DaysReturn += Math.abs(quantity);
                          }
                        } else {
                          totalSold += quantity;
                          if (saleDate >= thirtyDaysAgo) {
                            last30DaysSold += quantity;
                          }
                        }
                      }
                    }
                  });
                  
                  break; // Found TSIN data, no need to check SKU
                }
              }
              
              if (foundSalesData) break; // Found TSIN data, move to next collection
            }

            // FALLBACK: Query by SKU only if TSIN data not found
            if (!foundSalesData && sku && sku !== 'N/A') {
              const salesQuery = query(
                collection(db, collectionName),
                where('integrationId', '==', integrationId),
                where('sku', '==', sku)
              );
              
              const salesSnapshot = await getDocs(salesQuery);
              
              if (salesSnapshot.size > 0) {
                console.log(`Found ${salesSnapshot.size} sales records for SKU ${sku} in ${collectionName} (TSIN fallback)`);
                foundSalesData = true;
                
                salesSnapshot.forEach(saleDoc => {
                  const sale = saleDoc.data();
                  const quantity = sale.quantity || sale.quantity_sold || sale.units_sold || 1;
                  const orderDate = sale.order_date || sale.sale_date;
                  
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
                        totalReturn += Math.abs(quantity);
                        if (saleDate >= thirtyDaysAgo) {
                          last30DaysReturn += Math.abs(quantity);
                        }
                      } else {
                        totalSold += quantity;
                        if (saleDate >= thirtyDaysAgo) {
                          last30DaysSold += quantity;
                        }
                      }
                    }
                  }
                });
                break; // Found data, move to next collection
              }
            }
          } catch (error) {
            console.warn(`Could not query collection ${collectionName}:`, error);
          }
        }
          // If no sales data found in collections, fall back to sales_units array
        if (!foundSalesData) {
          totalSold = salesUnits.reduce((sum: number, unit: any) => sum + (unit.sales_units || 0), 0) || 0;
          console.log(`No sales records found for ${tsinId ? `TSIN ${tsinId}` : `SKU ${sku}`}, using sales_units: ${totalSold}`);
        }
      } catch (error) {
        console.warn(`Error calculating detailed metrics for ${tsinId ? `TSIN ${tsinId}` : `SKU ${sku}`}:`, error);
        // Fall back to sales_units array
        totalSold = salesUnits.reduce((sum: number, unit: any) => sum + (unit.sales_units || 0), 0) || 0;
      }// Calculate return rate: (total Return * 100 / Total sold Item)
      const returnRate = totalSold > 0 ? (totalReturn * 100) / totalSold : 0;
      
      // Calculate available quantity at Takealot
      const availableQtyAtTakealot = stockTotal;
      
      // Calculate quantity required: (Total Last 30 Days Sale - Available Qty At Takealot)
      const qtyRequire = Math.max(0, last30DaysSold - availableQtyAtTakealot);

      // Calculate total product sold amount (for avg selling price calculation)
      const totalProductSoldAmount = totalSold * (data.selling_price || 0);
      
      // Calculate average selling price: (Total Product Sold Amount / total Product Sold)
      const avgSellingPrice = totalSold > 0 ? totalProductSoldAmount / totalSold : (data.selling_price || 0);

      // Determine product status
      const getProductStatus = (): 'Buyable' | 'Not Buyable' | 'Disable' => {
        if (stockTotal === 0) return 'Disable';
        if (stockTotal < 5) return 'Not Buyable';
        return 'Buyable';
      };      return {
        image_url: data.image_url,
        title: data.title || 'Unnamed Product',
        tsin_id: tsinId,
        sku: sku,
        avgSellingPrice: Math.round(avgSellingPrice * 100) / 100, // Round to 2 decimal places
        totalSold: totalSold,
        totalReturn: totalReturn,
        last30DaysSold: last30DaysSold,
        last30DaysReturn: last30DaysReturn,
        daysSinceLastOrder: daysSinceLastOrder === 999 ? 999 : daysSinceLastOrder,
        returnRate: Math.round(returnRate * 100) / 100, // Round to 2 decimal places
        qtyRequire: qtyRequire,
        stock: stockTotal,
        availableQtyAtTakealot: availableQtyAtTakealot,
        totalProductSoldAmount: totalProductSoldAmount,
        productStatus: getProductStatus(),
        calculationMethod: tsinId ? 'TSIN-based' : 'SKU-fallback', // Track calculation method
        usedTsinData: foundSalesData && tsinId ? true : false // Track if TSIN data was actually used
      };
    });    const productData = await Promise.all(productDataPromises);

    // Sort by priority: low stock first, then by sales volume
    productData.sort((a, b) => {
      // Products with low stock first
      if (a.stock < 5 && b.stock >= 5) return -1;
      if (b.stock < 5 && a.stock >= 5) return 1;
      // Then by total sold (descending)
      return b.totalSold - a.totalSold;
    });

    // Check data size before caching - disable cache for large datasets
    const dataSize = JSON.stringify(productData).length;
    console.log('Product data size:', dataSize, 'bytes');
    
    if (dataSize < 800000) { // Only cache if under 800KB (leaving buffer for Firestore 1MB limit)
      console.log('Caching product data (size under limit)');
      await setCachedReportData(integrationId, 'product-performance', productData);
    } else {
      console.log('Skipping cache - data too large for Firestore document limit');
    }

    return productData;
  } catch (error) {
    console.error('Error loading comprehensive product data:', error);
    return [];
  }
}

/**
 * Clear cache for a specific integration
 */
export async function clearReportCache(integrationId: string): Promise<void> {
  try {
    const reportTypes = ['product-performance', 'sales-overview', 'sales-trends'];
    
    for (const reportType of reportTypes) {
      const cacheKey = `${integrationId}_${reportType}`;
      const cacheDoc = doc(db, 'reportCache', cacheKey);
      
      try {
        await setDoc(cacheDoc, { deleted: true }, { merge: true });
      } catch (error) {
        console.warn(`Could not clear cache for ${reportType}:`, error);
      }
    }
    
    console.log(`Cleared report cache for integration ${integrationId}`);
  } catch (error) {
    console.error('Error clearing report cache:', error);
  }
}
