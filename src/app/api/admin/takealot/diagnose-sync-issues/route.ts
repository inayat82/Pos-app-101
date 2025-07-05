// src/app/api/admin/takealot/diagnose-sync-issues/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { webshareService } from '@/modules/webshare/services';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');

    if (!integrationId) {
      return NextResponse.json({
        success: false,
        error: 'Integration ID is required'
      }, { status: 400 });
    }

    console.log(`[DiagnoseSyncIssues] Running diagnostics for integration ${integrationId}`);

    const diagnostics: any = {
      integrationId,
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // 1. Check integration exists and has API key
    try {
      const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
      
      if (!integrationDoc.exists) {
        diagnostics.checks.integration = {
          status: 'failed',
          error: 'Integration not found'
        };
        
        return NextResponse.json({
          success: false,
          error: 'Integration not found',
          diagnostics
        }, { status: 404 });
      }
      
      const integrationData = integrationDoc.data();
      const hasApiKey = !!integrationData?.apiKey;
      
      diagnostics.checks.integration = {
        status: 'passed',
        hasApiKey,
        adminId: integrationData?.adminId,
        accountName: integrationData?.accountName
      };
    } catch (error: any) {
      diagnostics.checks.integration = {
        status: 'failed',
        error: error.message
      };
    }

    // 2. Check Webshare service configuration
    try {
      const webshareConfig = await webshareService.getConfig();
      const isConfigured = webshareConfig.apiKey && webshareConfig.isEnabled;
      
      diagnostics.checks.webshareConfig = {
        status: isConfigured ? 'passed' : 'failed',
        isEnabled: webshareConfig.isEnabled,
        hasApiKey: !!webshareConfig.apiKey,
        testStatus: webshareConfig.testStatus,
        lastSyncAt: webshareConfig.lastSyncAt,
        lastTestError: webshareConfig.lastTestError
      };
    } catch (error: any) {
      diagnostics.checks.webshareConfig = {
        status: 'failed',
        error: error.message
      };
    }

    // 3. Check available proxies
    try {
      const proxiesData = await webshareService.getProxies(50, 0);
      const validProxies = proxiesData.proxies.filter(p => 
        p.valid && p.proxy_address && p.port && p.username && p.password
      );
      const southAfricanProxies = validProxies.filter(p => p.country_code === 'ZA');
      
      diagnostics.checks.proxies = {
        status: validProxies.length > 0 ? 'passed' : 'failed',
        totalProxies: proxiesData.proxies.length,
        validProxies: validProxies.length,
        southAfricanProxies: southAfricanProxies.length,
        countries: [...new Set(validProxies.map(p => p.country_code))].filter(Boolean)
      };
    } catch (error: any) {
      diagnostics.checks.proxies = {
        status: 'failed',
        error: error.message
      };
    }

    // 4. Check recent sync logs
    try {
      const recentLogs = await db
        .collection('logs')
        .where('integrationId', '==', integrationId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      const logs = recentLogs.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          status: data.status,
          cronJobName: data.cronJobName,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          errorMessage: data.errorMessage,
          triggerType: data.triggerType,
          totalReads: data.totalReads,
          totalWrites: data.totalWrites
        };
      });

      const failedLogs = logs.filter(log => log.status === 'failure');
      
      diagnostics.checks.recentLogs = {
        status: failedLogs.length === 0 ? 'passed' : 'warning',
        totalRecentLogs: logs.length,
        failedLogs: failedLogs.length,
        recentFailures: failedLogs.slice(0, 3).map(log => ({
          id: log.id,
          cronJobName: log.cronJobName,
          createdAt: log.createdAt,
          errorMessage: log.errorMessage
        }))
      };
    } catch (error: any) {
      diagnostics.checks.recentLogs = {
        status: 'failed',
        error: error.message
      };
    }

    // 5. Check required Node.js modules
    try {
      // Try to import the required modules
      await import('https-proxy-agent');
      await import('http-proxy-agent');
      await import('node-fetch');
      
      diagnostics.checks.dependencies = {
        status: 'passed',
        modules: ['https-proxy-agent', 'http-proxy-agent', 'node-fetch']
      };
    } catch (error: any) {
      diagnostics.checks.dependencies = {
        status: 'failed',
        error: error.message
      };
    }

    // Calculate overall status
    const checkStatuses = Object.values(diagnostics.checks).map((check: any) => check.status);
    const hasFailed = checkStatuses.includes('failed');
    const hasWarnings = checkStatuses.includes('warning');
    
    const overallStatus = hasFailed ? 'failed' : hasWarnings ? 'warning' : 'passed';
    
    diagnostics.overall = {
      status: overallStatus,
      summary: `${checkStatuses.filter(s => s === 'passed').length}/${checkStatuses.length} checks passed`
    };

    return NextResponse.json({
      success: true,
      diagnostics
    });

  } catch (error: any) {
    console.error('[DiagnoseSyncIssues] Unexpected error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}
