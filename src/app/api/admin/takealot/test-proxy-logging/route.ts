// src/app/api/admin/takealot/test-proxy-logging/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { autoPriceWebshareService } from '@/modules/auto-price/services/webshare.service';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  console.log('[TestProxyLogging] API endpoint called');
  try {
    const { integrationId, adminId, testUrl = 'https://httpbin.org/ip' } = await request.json();

    console.log('[TestProxyLogging] Request data:', { integrationId, adminId, testUrl });

    if (!integrationId || !adminId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Integration ID and Admin ID are required' 
      }, { status: 400 });
    }

    // Verify integration ownership
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({ 
        success: false, 
        error: 'Integration not found' 
      }, { status: 404 });
    }

    const integrationData = integrationDoc.data();
    if (integrationData?.adminId !== adminId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized access to this integration' 
      }, { status: 403 });
    }

    const webshareService = autoPriceWebshareService;
    
    // Test proxy functionality with enhanced logging
    const testResults = [];
    const numberOfTests = 3; // Test with 3 different proxies
    
    for (let i = 1; i <= numberOfTests; i++) {
      console.log(`[TestProxyLogging] Running test ${i}/${numberOfTests}`);
      
      try {
        const result = await webshareService.makeRequest({
          url: testUrl,
          method: 'GET',
          headers: {
            'User-Agent': 'TakealotPOS-ProxyTest/1.0',
            'Accept': 'application/json'
          },
          timeout: 10000,
          maxRetries: 1 // Single retry for testing
        });

        testResults.push({
          testNumber: i,
          success: result.success,
          proxyUsed: result.proxyUsed,
          statusCode: result.statusCode,
          responseData: result.data,
          error: result.error,
          timestamp: new Date().toISOString()
        });

        console.log(`[TestProxyLogging] Test ${i} completed:`, {
          success: result.success,
          proxyUsed: result.proxyUsed,
          statusCode: result.statusCode
        });

        // Add a small delay between tests
        if (i < numberOfTests) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error: any) {
        console.error(`[TestProxyLogging] Test ${i} failed:`, error);
        testResults.push({
          testNumber: i,
          success: false,
          proxyUsed: null,
          statusCode: 0,
          responseData: null,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Log the test results to Firebase for audit trail
    try {
      await db.collection('takealotIntegrations')
        .doc(integrationId)
        .collection('proxyTestLogs')
        .add({
          adminId,
          testUrl,
          testResults,
          totalTests: numberOfTests,
          successfulTests: testResults.filter(r => r.success).length,
          timestamp: new Date(),
          userAgent: request.headers.get('user-agent') || 'Unknown'
        });
    } catch (logError) {
      console.warn('[TestProxyLogging] Failed to log test results:', logError);
    }

    // Calculate summary statistics
    const successfulTests = testResults.filter(r => r.success);
    const uniqueProxiesUsed = new Set(testResults.map(r => r.proxyUsed).filter(Boolean));

    const summary = {
      totalTests: numberOfTests,
      successfulTests: successfulTests.length,
      failedTests: numberOfTests - successfulTests.length,
      successRate: (successfulTests.length / numberOfTests) * 100,
      uniqueProxiesUsed: uniqueProxiesUsed.size,
      proxiesTested: Array.from(uniqueProxiesUsed),
      averageResponseTime: 'N/A' // Could be enhanced with timing
    };

    console.log('[TestProxyLogging] Test summary:', summary);

    return NextResponse.json({
      success: true,
      message: 'Proxy logging test completed',
      summary,
      testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[TestProxyLogging] Error testing proxy logging:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to test proxy logging',
      message: error.message
    }, { status: 500 });
  }
}
