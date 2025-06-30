// src/app/api/cron/takealot-hourly-100-products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { ProductSyncService } from '@/lib/productSyncService';

export async function GET(request: NextRequest) {
  try {
    console.log('Starting takealot-hourly-100-products cron job');
    
    // Get all Takealot integrations that have the "Fetch 100 Products" strategy enabled
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

        // Check if this integration has the "Fetch 100 Products" strategy enabled for cron
        const preferencesRef = db.collection('takealotIntegrations')
          .doc(integrationId)
          .collection('preferences')
          .doc('syncStrategies');
        
        const preferencesDoc = await preferencesRef.get();
        
        if (preferencesDoc.exists) {
          const preferences = preferencesDoc.data();
          const productStrategies = preferences?.productStrategies || [];
          
          const strategy = productStrategies.find((s: any) => s.id === 'prd_100_3h');
          
          if (!strategy?.cronEnabled) {
            console.log(`Skipping integration ${integrationId}: prd_100_3h cron not enabled`);
            continue;
          }
        } else {
          console.log(`Skipping integration ${integrationId}: No sync preferences found`);
          continue;
        }

        console.log(`Processing hourly 100 products sync for integration: ${integrationId}`);
        
        // Initialize the Product Sync Service and perform sync
        const productSyncService = new ProductSyncService(integrationId);
        const syncResult = await productSyncService.syncProducts(
          apiKey,
          'Fetch 100 Products',
          'cron',
          adminId
        );

        results.push({
          integrationId,
          adminId,
          success: true,
          result: syncResult
        });

        console.log(`Completed hourly 100 products sync for ${integrationId}:`, syncResult);
        
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
    console.error('Takealot hourly 100 products cron job error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
