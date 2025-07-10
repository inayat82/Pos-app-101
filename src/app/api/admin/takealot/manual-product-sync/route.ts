// src/app/api/admin/takealot/manual-product-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { ProductSyncService } from '@/lib/productSyncService';
import { EnhancedSyncService } from '@/lib/enhancedSyncService';

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

    // Initialize the Enhanced Sync Service (dual-write enabled)
    const accountName = integrationData?.accountName || 'Takealot';
    const enhancedSyncService = new EnhancedSyncService(adminId, integrationId, accountName);
    
    // Perform the sync using enhanced service (Neon first, user choice for Firebase fallback)
    console.log(`[Manual Product Sync] Using Neon-first sync for ${integrationId}`);
    const result = await enhancedSyncService.syncProducts(
      apiKey,
      strategy,
      'manual'
    );

    // Handle the result based on whether Neon succeeded or failed
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Product sync completed successfully using ${result.strategy}`,
        result: {
          totalProcessed: result.totalRecords,
          neonRecords: result.neonRecords,
          firebaseRecords: result.firebaseRecords,
          strategy: result.strategy,
          timeTaken: result.timeTaken,
          warnings: result.warnings
        }
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
        message: 'Product sync failed completely',
        error: result.errors.join(', '),
        details: result
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Manual product sync error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Product sync failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
