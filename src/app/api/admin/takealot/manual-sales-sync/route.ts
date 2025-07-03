// src/app/api/admin/takealot/manual-sales-sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { SalesSyncService } from '@/lib/salesSyncService';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  console.log('[ManualSalesSync] API endpoint called');
  try {
    const { integrationId, strategy, adminId } = await request.json();
    console.log('[ManualSalesSync] Request data:', { integrationId, strategy, adminId });

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

    console.log(`[ManualSalesSync] Starting manual sales sync for integration ${integrationId}, strategy: ${strategy}`);

    // Use the new sales sync service
    console.log('[ManualSalesSync] Creating SalesSyncService...');
    const syncService = new SalesSyncService(integrationId);
    console.log('[ManualSalesSync] Calling syncService.syncSales...');
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
