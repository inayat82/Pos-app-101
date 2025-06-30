// src/app/api/admin/takealot/manual-product-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { ProductSyncService } from '@/lib/productSyncService';

export async function POST(request: NextRequest) {
  try {
    const { integrationId, strategy } = await request.json();

    if (!integrationId || !strategy) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: integrationId, strategy'
      }, { status: 400 });
    }

    // Get integration data and API key
    const integrationDocRef = db.collection('takealotIntegrations').doc(integrationId);
    const integrationDoc = await integrationDocRef.get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Takealot integration not found'
      }, { status: 404 });
    }
    
    const integrationData = integrationDoc.data();
    const apiKey = integrationData?.apiKey;
    const adminId = integrationData?.adminId;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not found for this integration'
      }, { status: 400 });
    }

    // Initialize the Product Sync Service
    const productSyncService = new ProductSyncService(integrationId);
    
    // Perform the sync
    const result = await productSyncService.syncProducts(
      apiKey,
      strategy,
      'manual',
      adminId
    );

    return NextResponse.json({
      success: true,
      message: `Product sync completed for ${strategy}`,
      result: {
        totalProcessed: result.totalProcessed,
        totalNew: result.totalNew,
        totalUpdated: result.totalUpdated,
        totalErrors: result.totalErrors,
        totalSkipped: result.totalSkipped
      }
    });

  } catch (error: any) {
    console.error('Manual product sync error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Product sync failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
