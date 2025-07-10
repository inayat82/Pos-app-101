// src/app/api/test-enhanced-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { EnhancedSyncService } from '@/lib/enhancedSyncService';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { integrationId, strategy = 'Fetch 100 Products', dataType = 'products' } = await request.json();

    if (!integrationId) {
      return NextResponse.json({
        success: false,
        error: 'Integration ID is required'
      }, { status: 400 });
    }

    // Get integration data
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Integration not found'
      }, { status: 404 });
    }

    const integrationData = integrationDoc.data();
    const apiKey = integrationData?.apiKey;
    const adminId = integrationData?.adminId;
    
    if (!apiKey || !adminId) {
      return NextResponse.json({
        success: false,
        error: 'API key or admin ID not found'
      }, { status: 400 });
    }

    console.log(`[TestEnhancedSync] Testing enhanced sync for ${integrationId}`);
    console.log(`[TestEnhancedSync] Admin ID: ${adminId}, Strategy: ${strategy}, Data Type: ${dataType}`);

    // Initialize Enhanced Sync Service
    const enhancedSyncService = new EnhancedSyncService(adminId, integrationId);
    
    let result;
    const startTime = Date.now();

    if (dataType === 'products') {
      result = await enhancedSyncService.syncProducts(apiKey, strategy, 'manual');
    } else if (dataType === 'sales') {
      result = await enhancedSyncService.syncSales(apiKey, strategy, 'manual');
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid data type. Use "products" or "sales"'
      }, { status: 400 });
    }

    const totalTime = Date.now() - startTime;

    console.log(`[TestEnhancedSync] Completed in ${totalTime}ms:`, result);

    return NextResponse.json({
      success: true,
      message: `Enhanced ${dataType} sync completed with dual-write`,
      testResults: {
        integrationId,
        adminId,
        syncStrategy: strategy,
        dataType,
        totalTime,
        ...result
      }
    });

  } catch (error: any) {
    console.error('[TestEnhancedSync] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Enhanced sync test failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
