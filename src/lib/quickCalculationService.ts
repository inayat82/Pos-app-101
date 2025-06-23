// src/lib/quickCalculationService.ts

import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

/**
 * Quick calculation service to populate missing calculated fields in takealot_offers
 * This runs on the client side and saves basic calculations directly to the database
 */

interface QuickCalculationProgress {
  processed: number;
  total: number;
  currentProduct: string;
  status: string;
}

export async function runQuickCalculation(
  integrationId: string,
  onProgress?: (progress: QuickCalculationProgress) => void
): Promise<{ success: number; errors: string[] }> {
  console.log('[QUICK CALC] Starting quick calculation for missing fields...');
  
  try {
    // Get all products for this integration
    const offersQuery = query(
      collection(db, 'takealot_offers'),
      where('integrationId', '==', integrationId)
    );
    
    const offersSnapshot = await getDocs(offersQuery);
    const products = offersSnapshot.docs;
    
    if (products.length === 0) {
      throw new Error('No products found for this integration');
    }

    console.log(`[QUICK CALC] Found ${products.length} products to process`);
    
    let successCount = 0;
    const errors: string[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    // Process each product
    for (let i = 0; i < products.length; i++) {
      const productDoc = products[i];
      const data = productDoc.data();
      const productId = data.tsin_id || data.sku || productDoc.id;
      
      if (onProgress) {
        onProgress({
          processed: i,
          total: products.length,
          currentProduct: productId,
          status: `Processing ${data.title || productId}...`
        });
      }
      
      try {
        // Check if already has calculated data
        const hasCalculatedData = data.total_sold > 0 || data.lastTsinCalculation;
        
        if (hasCalculatedData) {
          console.log(`[QUICK CALC] Skipping ${productId} - already has calculated data`);
          successCount++;
          continue;
        }
        
        // Calculate basic metrics from sales_units array if available
        const salesUnits = data.sales_units || [];
        const stockTotal = data.stock_at_takealot_total || 0;
        
        let totalSold = 0;
        let totalReturn = 0;
        let last30DaysSold = 0;
        let last30DaysReturn = 0;
        let daysSinceLastOrder = 999;
        
        // Process sales_units array
        if (Array.isArray(salesUnits) && salesUnits.length > 0) {
          salesUnits.forEach((unit: any) => {
            const quantity = Math.abs(unit.quantity || unit.sales_units || 1);
            const orderDate = unit.order_date || unit.sale_date;
            
            if (orderDate) {
              const saleDate = new Date(orderDate);
              if (!isNaN(saleDate.getTime())) {
                const daysDiff = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysDiff < daysSinceLastOrder) {
                  daysSinceLastOrder = daysDiff;
                }
                
                const isReturn = unit.is_return || unit.return_status || quantity < 0;
                
                if (isReturn) {
                  totalReturn += quantity;
                  if (saleDate >= thirtyDaysAgo) {
                    last30DaysReturn += quantity;
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
        }
        
        // Calculate derived metrics
        const returnRate = totalSold > 0 ? (totalReturn / totalSold) * 100 : 0;
        const avgSellingPrice = data.selling_price || data.price || 0;
        const qtyRequire = Math.max(0, last30DaysSold - stockTotal);
        
        // Determine product status
        let productStatus: 'Buyable' | 'Not Buyable' | 'Disable' = 'Buyable';
        if (stockTotal === 0) {
          productStatus = 'Disable';
        } else if (stockTotal < 5) {
          productStatus = 'Not Buyable';
        }
        
        // Prepare update data
        const updateData = {
          total_sold: totalSold,
          total_return: totalReturn,
          last_30_days_sold: last30DaysSold,
          last_30_days_return: last30DaysReturn,
          days_since_last_order: daysSinceLastOrder === 999 ? 999 : daysSinceLastOrder,
          return_rate: Math.round(returnRate * 100) / 100,
          quantity_required: qtyRequire,
          product_status: productStatus,
          avg_selling_price: avgSellingPrice,
          lastQuickCalculation: now,
          calculationMethod: 'quick-client-side'
        };
        
        // Save to database
        await updateDoc(productDoc.ref, updateData);
        
        console.log(`[QUICK CALC] ✅ Updated ${productId}: ${totalSold} sold, ${productStatus} status`);
        successCount++;
        
      } catch (error) {
        const errorMsg = `Error processing ${productId}: ${error}`;
        console.error(`[QUICK CALC] ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
      
      // Small delay to prevent overwhelming Firestore
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[QUICK CALC] 🎉 Quick calculation complete. Success: ${successCount}, Errors: ${errors.length}`);
    
    return { success: successCount, errors };
    
  } catch (error) {
    console.error('[QUICK CALC] ❌ Quick calculation failed:', error);
    throw error;
  }
}
