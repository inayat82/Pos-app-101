// src/app/api/admin/takealot/manual-sales-sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { SalesSyncService } from '@/lib/salesSyncService';
import { EnhancedSyncService } from '@/lib/enhancedSyncService';
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

    // Get admin ID from integration data
    const actualAdminId = adminId || integrationData?.adminId;
    
    if (!actualAdminId) {
      console.log('[ManualSalesSync] Admin ID not found');
      return NextResponse.json({ 
        success: false, 
        error: 'Admin ID not found for this integration' 
      }, { status: 400 });
    }

    // Use the Enhanced Sync Service (Neon first, user choice for Firebase fallback)
    console.log('[ManualSalesSync] Creating EnhancedSyncService...');
    const accountName = integrationData?.accountName || 'Takealot';
    const enhancedSyncService = new EnhancedSyncService(actualAdminId, integrationId, accountName);
    console.log('[ManualSalesSync] Calling enhancedSyncService.syncSales with Neon-first...');
    const result = await enhancedSyncService.syncSales(apiKey, strategy, 'manual');

    console.log(`[ManualSalesSync] Enhanced sales sync completed for ${integrationId}:`, result);

    // Handle the result based on whether Neon succeeded or failed
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Sales sync completed successfully using ${result.strategy}`,
        totalProcessed: result.totalRecords,
        neonRecords: result.neonRecords,
        firebaseRecords: result.firebaseRecords,
        strategy: result.strategy,
        timeTaken: result.timeTaken,
        warnings: result.warnings
      });
    } else if (result.needsUserChoice) {
      // Neon failed, ask user if they want Firebase fallback
      return NextResponse.json({
        success: false,
        needsUserChoice: true,
        message: 'Neon sync failed. Do you want to use Firebase as fallback?',
        error: result.neonError,
        totalRecords: result.totalRecords,
        neonError: result.neonError
      }, { status: 206 }); // 206 Partial Content - indicates user choice needed
    } else {
      // Complete failure
      return NextResponse.json({
        success: false,
        message: 'Sales sync failed completely',
        error: result.errors.join(', '),
        details: result
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[ManualSalesSync] Error in manual sales sync:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}
