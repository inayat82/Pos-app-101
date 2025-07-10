// src/app/api/cron/takealot-6hourly-all-products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { ProductSyncService } from '@/lib/productSyncService';
import { EnhancedSyncService } from '@/lib/enhancedSyncService';
import { ChangeDetectionService } from '@/lib/changeDetectionService';

export async function GET(request: NextRequest) {
  try {
    console.log('Starting takealot-6hourly-all-products cron job');
    
    // Get all Takealot integrations that have the "Fetch All Products (6h)" strategy enabled
    const integrationsSnapshot = await db.collection('takealotIntegrations').get();
    
    if (integrationsSnapshot.empty) {
      console.log('No Takealot integrations found');
      return NextResponse.json({
        success: true,
        message: 'No integrations to process',
        results: []
      });
    }

    const results: any[] = [];
    
    for (const integrationDoc of integrationsSnapshot.docs) {
      try {
        const integrationData = integrationDoc.data();
        const integrationId = integrationDoc.id;
        const apiKey = integrationData?.apiKey;
        const adminId = integrationData?.adminId;
        
        if (!apiKey) {
          console.log(`Skipping integration ${integrationId}: No API key`);
          continue;
        }

        // Check if this integration has the "Fetch All Products (6h)" strategy enabled for cron
        const preferencesRef = db.collection('takealotIntegrations')
          .doc(integrationId)
          .collection('preferences')
          .doc('syncStrategies');
        
        const preferencesDoc = await preferencesRef.get();
        
        if (preferencesDoc.exists) {
          const preferences = preferencesDoc.data();
          const productStrategies = preferences?.productStrategies || [];
          
          const strategy = productStrategies.find((s: any) => s.id === 'prd_all_6h');
          
          if (!strategy?.cronEnabled) {
            console.log(`Skipping integration ${integrationId}: prd_all_6h cron not enabled`);
            continue;
          }
        } else {
          console.log(`Skipping integration ${integrationId}: No sync preferences found`);
          continue;
        }

        console.log(`Processing enhanced 6-hourly all products sync for integration: ${integrationId}`);
        
        // Initialize the Enhanced Sync Service for dual-write functionality
        const accountName = integrationData?.accountName || 'Takealot';
        const enhancedSyncService = new EnhancedSyncService(adminId, integrationId, accountName);
        const syncResult = await enhancedSyncService.syncProducts(
          apiKey,
          'Fetch All Products (6h)',
          'cron'
        );

        // Get cost savings statistics
        const costSavings = await ChangeDetectionService.getCostSavingsStats(integrationId, 1); // Last 24 hours

        results.push({
          integrationId,
          adminId,
          success: syncResult.success,
          result: {
            totalProcessed: syncResult.totalRecords,
            neonRecords: syncResult.neonRecords,
            firebaseRecords: syncResult.firebaseRecords,
            strategy: syncResult.strategy,
            timeTaken: syncResult.timeTaken,
            errors: syncResult.errors,
            warnings: syncResult.warnings
          },
          optimizationStats: {
            apiCallsSaved: costSavings.totalApiCallsSaved,
            recordsSkipped: costSavings.totalRecordsNotProcessed,
            estimatedSavings: costSavings.estimatedCostSavings
          }
        });

        console.log(`Completed enhanced 6-hourly all products sync with dual-write for ${integrationId}:`, {
          ...syncResult,
          costSavings
        });
        
      } catch (error: any) {
        console.error(`Error processing integration ${integrationDoc.id}:`, error);
        results.push({
          integrationId: integrationDoc.id,
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} integrations`,
      results: results
    });

  } catch (error: any) {
    console.error('Takealot 6-hourly all products cron job error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
