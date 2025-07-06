// src/app/api/admin/takealot/manual-new-sales-sync/route.ts
/**
 * Manual New Sales Sync - Admin Endpoint
 * Allows manual triggering of incremental sync from last order_id
 * Created: July 6, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { NewSalesSyncService } from '@/lib/newSalesSyncService';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  console.log('[ManualNewSalesSync] API endpoint called');
  try {
    const { integrationId, adminId } = await request.json();
    console.log('[ManualNewSalesSync] Request data:', { integrationId, adminId });

    if (!integrationId) {
      console.log('[ManualNewSalesSync] Missing integration ID');
      return NextResponse.json({ 
        success: false, 
        error: 'Integration ID is required' 
      }, { status: 400 });
    }

    if (!adminId) {
      console.log('[ManualNewSalesSync] Missing admin ID');
      return NextResponse.json({ 
        success: false, 
        error: 'Admin ID is required' 
      }, { status: 400 });
    }

    console.log('[ManualNewSalesSync] Getting integration data...');
    // Get integration data and API key
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    
    if (!integrationDoc.exists) {
      console.log('[ManualNewSalesSync] Integration not found:', integrationId);
      return NextResponse.json({ 
        success: false, 
        error: 'Integration not found' 
      }, { status: 404 });
    }

    const integrationData = integrationDoc.data();
    const apiKey = integrationData?.apiKey;
    
    if (!apiKey) {
      console.log('[ManualNewSalesSync] API key not found for integration:', integrationId);
      return NextResponse.json({ 
        success: false, 
        error: 'API key not found for this integration' 
      }, { status: 400 });
    }

    console.log('[ManualNewSalesSync] Starting New Sales sync...');
    
    // Initialize New Sales sync service
    const newSalesSyncService = new NewSalesSyncService();
    
    // Perform the incremental sync
    const syncResult = await newSalesSyncService.syncNewSalesFromLastOrderId(
      integrationId,
      apiKey,
      adminId
    );

    console.log('[ManualNewSalesSync] Sync completed:', {
      success: syncResult.success,
      message: syncResult.message,
      records: {
        apiRead: syncResult.apiRecordsRead,
        created: syncResult.recordsCreated,
        updated: syncResult.recordsUpdated,
        skipped: syncResult.recordsSkipped
      }
    });

    // Return detailed response with all metrics
    return NextResponse.json({
      success: syncResult.success,
      message: syncResult.message,
      
      // Detailed metrics
      metrics: {
        apiRecordsRead: syncResult.apiRecordsRead,
        recordsCreated: syncResult.recordsCreated,
        recordsUpdated: syncResult.recordsUpdated,
        recordsSkipped: syncResult.recordsSkipped,
        totalProcessed: syncResult.recordsCreated + syncResult.recordsUpdated
      },
      
      // Order ID tracking
      orderIdTracking: {
        lastOrderId: syncResult.lastOrderId,
        newLastOrderId: syncResult.newLastOrderId,
        orderIdUpdated: syncResult.newLastOrderId !== syncResult.lastOrderId
      },
      
      // Optimization stats
      optimizationStats: syncResult.optimizationStats,
      
      // Enhanced features
      enhancedFeatures: syncResult.enhancedFeatures,
      
      // Performance
      performance: {
        executionTime: syncResult.executionTime,
        timestamp: syncResult.timestamp
      },
      
      // Integration info
      integration: {
        integrationId,
        adminId,
        hasApiKey: !!apiKey
      }
    });

  } catch (error) {
    console.error('[ManualNewSalesSync] Error during sync:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'New Sales sync failed',
      metrics: {
        apiRecordsRead: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        totalProcessed: 0
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
