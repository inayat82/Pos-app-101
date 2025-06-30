// src/app/api/admin/takealot/manual-sales-sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { SalesSyncService } from '@/lib/salesSyncService';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { integrationId, strategy, adminId } = await request.json();

    if (!integrationId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Integration ID is required' 
      }, { status: 400 });
    }

    if (!strategy) {
      return NextResponse.json({ 
        success: false, 
        error: 'Strategy is required' 
      }, { status: 400 });
    }

    // Get integration data and API key
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({ 
        success: false, 
        error: 'Integration not found' 
      }, { status: 404 });
    }

    const integrationData = integrationDoc.data();
    const apiKey = integrationData?.apiKey;
    
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'API key not found for this integration' 
      }, { status: 400 });
    }

    console.log(`[ManualSalesSync] Starting manual sales sync for integration ${integrationId}, strategy: ${strategy}`);

    // Use the new sales sync service
    const syncService = new SalesSyncService(integrationId);
    const result = await syncService.syncSales(apiKey, strategy, 'manual', adminId);

    console.log(`[ManualSalesSync] Manual sales sync completed for ${integrationId}:`, result);

    return NextResponse.json({
      success: true,
      message: 'Sales sync completed successfully',
      totalProcessed: result.totalProcessed,
      totalNew: result.totalNew,
      totalUpdated: result.totalUpdated,
      totalErrors: result.totalErrors,
      totalSkipped: result.totalSkipped
    });

  } catch (error: any) {
    console.error('[ManualSalesSync] Error in manual sales sync:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}
