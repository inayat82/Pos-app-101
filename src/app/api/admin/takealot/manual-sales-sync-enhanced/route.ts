// src/app/api/admin/takealot/manual-sales-sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { SalesSyncService } from '@/lib/salesSyncService';
import { fetchAndSaveTakealotDataEnhanced } from '@/modules/takealot/services/enhanced-sync-strategy.service';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  console.log('[ManualSalesSync] API endpoint called');
  try {
    const { integrationId, strategy, adminId, useEnhanced = true } = await request.json();
    console.log('[ManualSalesSync] Request data:', { integrationId, strategy, adminId, useEnhanced });

    if (!integrationId) {
      console.log('[ManualSalesSync] Missing integration ID');
      return NextResponse.json({ 
        success: false, 
        error: 'Integration ID is required' 
      }, { status: 400 });
    }

    if (!strategy) {
      console.log('[ManualSalesSync] Missing strategy');
      return NextResponse.json({ 
        success: false, 
        error: 'Strategy is required' 
      }, { status: 400 });
    }

    console.log('[ManualSalesSync] Getting integration data...');
    // Get integration data and API key
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    
    if (!integrationDoc.exists) {
      console.log('[ManualSalesSync] Integration not found:', integrationId);
      return NextResponse.json({ 
        success: false, 
        error: 'Integration not found' 
      }, { status: 404 });
    }

    const integrationData = integrationDoc.data();
    const apiKey = integrationData?.apiKey;
    
    if (!apiKey) {
      console.log('[ManualSalesSync] API key not found for integration:', integrationId);
      return NextResponse.json({ 
        success: false, 
        error: 'API key not found for this integration' 
      }, { status: 400 });
    }

    const actualAdminId = integrationData?.adminId || adminId;
    
    if (!actualAdminId) {
      console.log('[ManualSalesSync] Admin ID not found');
      return NextResponse.json({ 
        success: false, 
        error: 'Admin ID not found' 
      }, { status: 400 });
    }

    // Use enhanced sync strategy (default)
    let shouldUseEnhanced = useEnhanced;
    
    if (shouldUseEnhanced) {
      console.log('[ManualSalesSync] Using enhanced sync strategy with concurrent processing');
      
      try {
        const enhancedOptions = {
          maxConcurrentPages: 6, // Balanced concurrency for sales
          batchSize: 150,
          retryAttempts: 3,
          delayBetweenBatches: 700
        };

        const result = await fetchAndSaveTakealotDataEnhanced(
          '/v2/sales',
          apiKey,
          actualAdminId,
          'sales',
          undefined, // No page limit for manual sync
          enhancedOptions
        );

        if (result.success) {
          return NextResponse.json({
            success: true,
            result: {
              totalProcessed: result.totalItemsFetched,
              neonRecords: result.neonRecords,
              firebaseRecords: result.firebaseRecords,
              strategy: result.strategy,
              processingTime: result.processingTime,
              concurrentPages: result.concurrentPages
            },
            message: `Enhanced sales sync completed: ${result.totalItemsFetched} records processed`,
            needsUserChoice: false
          });
        } else {
          // Enhanced sync failed, but might have partial data
          if (result.neonRecords > 0 || result.firebaseRecords > 0) {
            return NextResponse.json({
              success: true,
              result: {
                totalProcessed: result.totalItemsFetched,
                neonRecords: result.neonRecords,
                firebaseRecords: result.firebaseRecords,
                strategy: result.strategy,
                processingTime: result.processingTime
              },
              message: `Enhanced sales sync completed with warnings: ${result.message}`,
              needsUserChoice: false
            });
          } else {
            // Fall back to legacy sync
            console.log('[ManualSalesSync] Enhanced sync failed, falling back to legacy sync');
            shouldUseEnhanced = false;
          }
        }
      } catch (enhancedError: any) {
        console.error('[ManualSalesSync] Enhanced sync error, falling back to legacy:', enhancedError.message);
        // Fall back to legacy sync
        shouldUseEnhanced = false;
      }
    }

    // Legacy sync fallback
    if (!shouldUseEnhanced) {
      console.log('[ManualSalesSync] Using legacy sync strategy');
      
      // Use legacy SalesSyncService as fallback
      const syncService = new SalesSyncService(integrationId);
      
      try {
        // Start logging
        await syncService.startLogging('manual', 'enhanced-fallback', actualAdminId);
        
        // Get integration data for API key
        const salesRecords = await syncService.fetchSalesFromAPI(apiKey, 'Last 100', 'manual');
        const result = await syncService.processSalesRecords(salesRecords);
        
        // Complete logging
        await syncService.completeLogging(result, 'enhanced-fallback', 'manual', true);

        return NextResponse.json({
          success: true,
          result: {
            totalProcessed: result.totalProcessed,
            neonRecords: 0, // Legacy sync doesn't use Neon
            firebaseRecords: result.totalNew + result.totalUpdated,
            strategy: 'firebase-legacy'
          },
          message: 'Legacy sales sync completed successfully',
          needsUserChoice: false
        });
        
      } catch (legacyError: any) {
        // Complete logging with error
        const errorResult = { totalProcessed: 0, totalNew: 0, totalUpdated: 0, totalErrors: 1, totalSkipped: 0 };
        await syncService.completeLogging(errorResult, 'enhanced-fallback', 'manual', false);
        
        return NextResponse.json({
          success: false,
          error: legacyError.message || 'Legacy sales sync failed'
        }, { status: 500 });
      }
    }

  } catch (error: any) {
    console.error('[ManualSalesSync] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Unexpected error during sales sync',
      message: error.message 
    }, { status: 500 });
  }
}
