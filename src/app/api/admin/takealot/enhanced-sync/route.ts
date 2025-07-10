// src/app/api/admin/takealot/enhanced-sync/route.ts
// Enhanced sync API endpoint with concurrent processing and Neon database support

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { fetchAndSaveTakealotDataEnhanced } from '@/modules/takealot/services/enhanced-sync-strategy.service';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    console.log('[EnhancedSyncAPI] Starting enhanced sync request');
    
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Missing or invalid authorization header'
      }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    if (!decodedToken?.uid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication token'
      }, { status: 401 });
    }

    const body = await request.json();
    const { integrationId, dataType, strategy, maxPages, concurrentOptions } = body;

    if (!integrationId || !dataType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: integrationId, dataType'
      }, { status: 400 });
    }

    if (!['products', 'sales'].includes(dataType)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid dataType. Must be "products" or "sales"'
      }, { status: 400 });
    }

    console.log(`[EnhancedSyncAPI] Processing ${dataType} sync for integration ${integrationId}`);

    // Get integration details
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Integration not found'
      }, { status: 404 });
    }

    const integrationData = integrationDoc.data();
    if (!integrationData) {
      return NextResponse.json({
        success: false,
        error: 'Integration data not found'
      }, { status: 404 });
    }

    // Verify user owns this integration
    if (integrationData.adminId !== decodedToken.uid) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized access to integration'
      }, { status: 403 });
    }

    const { adminId, apiKey, accountName } = integrationData;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not found in integration'
      }, { status: 400 });
    }

    // Determine endpoint based on data type
    const endpoint = dataType === 'products' ? '/v2/offers' : '/v2/sales';

    // Enhanced concurrent sync options
    const enhancedOptions = {
      maxConcurrentPages: 8, // High concurrency for faster processing
      batchSize: 200,
      retryAttempts: 3,
      delayBetweenBatches: 500, // Reduced delay for faster processing
      ...concurrentOptions
    };

    console.log(`[EnhancedSyncAPI] Starting enhanced sync with options:`, enhancedOptions);

    // Execute enhanced sync
    const result = await fetchAndSaveTakealotDataEnhanced(
      endpoint,
      apiKey,
      adminId,
      dataType,
      maxPages,
      enhancedOptions
    );

    if (result.success) {
      // Return success response with detailed stats
      return NextResponse.json({
        success: true,
        result: {
          totalProcessed: result.totalItemsFetched,
          neonRecords: result.neonRecords,
          firebaseRecords: result.firebaseRecords,
          strategy: result.strategy,
          processingTime: result.processingTime,
          concurrentPages: result.concurrentPages,
          errors: result.totalErrors
        },
        message: `Enhanced ${dataType} sync completed successfully`,
        needsUserChoice: false
      });
    } else {
      // Handle partial success or failure
      if (result.neonRecords > 0 || result.firebaseRecords > 0) {
        // Partial success - some data was saved
        return NextResponse.json({
          success: true,
          result: {
            totalProcessed: result.totalItemsFetched,
            neonRecords: result.neonRecords,
            firebaseRecords: result.firebaseRecords,
            strategy: result.strategy,
            processingTime: result.processingTime,
            concurrentPages: result.concurrentPages,
            errors: result.totalErrors
          },
          message: `Enhanced ${dataType} sync completed with warnings: ${result.message}`,
          needsUserChoice: false,
          warnings: [result.message]
        });
      } else {
        // Complete failure
        return NextResponse.json({
          success: false,
          error: result.message,
          totalErrors: result.totalErrors,
          processingTime: result.processingTime
        }, { status: 500 });
      }
    }

  } catch (error: any) {
    console.error('[EnhancedSyncAPI] Enhanced sync error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Enhanced sync failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// GET endpoint for health check and configuration
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'health') {
      return NextResponse.json({
        status: 'healthy',
        service: 'enhanced-sync',
        features: [
          'concurrent-processing',
          'neon-database-support',
          'proxy-ip-rotation',
          'retry-logic',
          'batch-processing'
        ],
        maxConcurrentPages: 10,
        defaultBatchSize: 200,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'config') {
      return NextResponse.json({
        defaultOptions: {
          maxConcurrentPages: 8,
          batchSize: 200,
          retryAttempts: 3,
          delayBetweenBatches: 500
        },
        limits: {
          maxConcurrentPages: 15,
          maxBatchSize: 500,
          maxRetryAttempts: 5
        },
        recommendations: {
          sales: {
            maxConcurrentPages: 8,
            batchSize: 200,
            delayBetweenBatches: 500
          },
          products: {
            maxConcurrentPages: 10,
            batchSize: 250,
            delayBetweenBatches: 300
          }
        }
      });
    }

    return NextResponse.json({
      error: 'Invalid action parameter'
    }, { status: 400 });

  } catch (error: any) {
    console.error('[EnhancedSyncAPI] GET error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process GET request',
      message: error.message
    }, { status: 500 });
  }
}
