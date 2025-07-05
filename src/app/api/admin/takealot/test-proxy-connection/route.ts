// src/app/api/admin/takealot/test-proxy-connection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { takealotProxyService } from '@/modules/takealot/services';

export async function POST(request: NextRequest) {
  try {
    const { integrationId } = await request.json();

    if (!integrationId) {
      return NextResponse.json({
        success: false,
        error: 'Integration ID is required'
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

    console.log(`[TestProxyConnection] Testing proxy connection for integration ${integrationId}`);

    // Test connection to Takealot API through proxy
    const startTime = Date.now();
    
    try {
      const testResponse = await takealotProxyService.checkConnection(apiKey, {
        adminId: adminId || integrationId,
        integrationId,
        requestType: 'manual',
        dataType: 'products'
      });

      const responseTime = Date.now() - startTime;

      console.log(`[TestProxyConnection] Test completed in ${responseTime}ms:`, {
        success: testResponse.success,
        statusCode: testResponse.statusCode,
        proxyUsed: testResponse.proxyUsed,
        error: testResponse.error
      });

      if (testResponse.success) {
        return NextResponse.json({
          success: true,
          message: 'Proxy connection test successful',
          details: {
            responseTime,
            proxyUsed: testResponse.proxyUsed,
            statusCode: testResponse.statusCode,
            apiResponse: testResponse.data
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Proxy connection test failed',
          details: {
            responseTime,
            statusCode: testResponse.statusCode,
            error: testResponse.error,
            proxyUsed: testResponse.proxyUsed
          }
        }, { status: 500 });
      }

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.error('[TestProxyConnection] Error during proxy test:', error);
      
      return NextResponse.json({
        success: false,
        error: 'Proxy connection test failed with exception',
        details: {
          responseTime,
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[TestProxyConnection] Unexpected error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}
