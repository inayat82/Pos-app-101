// src/app/api/test-dual-write/route.ts
/**
 * API Route to test dual-write functionality
 * This endpoint allows testing the Neon-first, Firebase-fallback strategy
 */

import { NextRequest, NextResponse } from 'next/server';
import { testDualWriteSetup, createEnhancedSyncService } from '@/lib/enhancedSyncService';
import { dualWriteTakealotData, TakealotRecord } from '@/lib/dualWriteService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminUid = searchParams.get('adminUid');
    const integrationId = searchParams.get('integrationId');

    if (!adminUid || !integrationId) {
      return NextResponse.json({
        success: false,
        error: 'Missing adminUid or integrationId parameters'
      }, { status: 400 });
    }

    console.log(`[TestDualWrite] Testing dual-write setup for Admin: ${adminUid}, Integration: ${integrationId}`);

    // Test dual-write setup
    const setupTest = await testDualWriteSetup(adminUid, integrationId);

    return NextResponse.json({
      success: true,
      adminUid,
      integrationId,
      connections: setupTest.connections,
      tableNames: setupTest.tableNames,
      ready: setupTest.ready,
      message: setupTest.ready 
        ? 'Dual-write setup is ready for migration' 
        : 'Dual-write setup has issues - check connections',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[TestDualWrite] Error testing dual-write setup:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminUid, integrationId, testData, dataType } = body;

    if (!adminUid || !integrationId || !testData || !dataType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: adminUid, integrationId, testData, dataType'
      }, { status: 400 });
    }

    if (!['sales', 'offers'].includes(dataType)) {
      return NextResponse.json({
        success: false,
        error: 'dataType must be either "sales" or "offers"'
      }, { status: 400 });
    }

    console.log(`[TestDualWrite] Testing dual-write with ${testData.length} ${dataType} records`);

    // Create test records
    const testRecords: TakealotRecord[] = testData.map((record: any, index: number) => ({
      integration_id: integrationId,
      admin_uid: adminUid,
      
      // Sales test data
      ...(dataType === 'sales' && {
        order_id: record.order_id || `TEST_ORDER_${Date.now()}_${index}`,
        product_title: record.product_title || `Test Product ${index}`,
        customer_name: record.customer_name || `Test Customer ${index}`,
        order_date: record.order_date || new Date().toISOString(),
        selling_price: record.selling_price || 100.00,
        quantity: record.quantity || 1,
        status: record.status || 'shipped',
        tsin_id: record.tsin_id || `TEST_TSIN_${index}`,
        sku: record.sku || `TEST_SKU_${index}`,
        commission: record.commission || 10.00,
        is_return: record.is_return || false
      }),

      // Offers test data
      ...(dataType === 'offers' && {
        tsin_id: record.tsin_id || `TEST_TSIN_${Date.now()}_${index}`,
        tsin: record.tsin || `TEST_TSIN_${index}`,
        sku: record.sku || `TEST_SKU_${index}`,
        product_title: record.product_title || `Test Product ${index}`,
        brand: record.brand || 'Test Brand',
        category: record.category || 'Test Category',
        subcategory: record.subcategory || 'Test Subcategory',
        selling_price: record.selling_price || 100.00,
        cost_price: record.cost_price || 80.00,
        recommended_retail_price: record.recommended_retail_price || 120.00,
        stock_at_takealot_total: record.stock_at_takealot_total || 10,
        is_active: record.is_active !== false,
        offer_id: record.offer_id || `TEST_OFFER_${Date.now()}_${index}`,
        status: record.status || 'active'
      }),

      // Common metadata
      created_at: new Date(),
      updated_at: new Date(),
      synced_from_firebase: false
    }));

    // Test dual-write
    const result = await dualWriteTakealotData(
      adminUid,
      integrationId,
      dataType as 'sales' | 'offers',
      testRecords
    );

    return NextResponse.json({
      success: result.success,
      result: {
        strategy: result.strategy,
        recordsProcessed: result.recordsProcessed,
        neonRecordsWritten: result.neonRecordsWritten,
        firebaseRecordsWritten: result.firebaseRecordsWritten,
        neonSuccess: result.neonSuccess,
        firebaseSuccess: result.firebaseSuccess,
        errors: result.errors,
        warnings: result.warnings
      },
      testData: {
        recordCount: testRecords.length,
        dataType,
        adminUid,
        integrationId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[TestDualWrite] Error testing dual-write:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
