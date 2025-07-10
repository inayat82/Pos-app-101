// src/app/api/admin/takealot/proxy-stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { enhancedTakealotLogger } from '@/lib/enhancedTakealotLogger';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  console.log('[ProxyStats] API endpoint called');
  try {
    const { 
      integrationId, 
      adminId, 
      timeRange = '24h',
      includeDetailedLogs = false 
    } = await request.json();

    console.log('[ProxyStats] Request data:', { integrationId, adminId, timeRange, includeDetailedLogs });

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

    // Calculate time range
    let since: Date;
    switch (timeRange) {
      case '1h':
        since = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '6h':
        since = new Date(Date.now() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
      default:
        since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get proxy statistics
    const stats = await enhancedTakealotLogger.getProxyStats(adminId, integrationId, since);

    // Get recent logs if requested
    let recentLogs = [];
    if (includeDetailedLogs) {
      const operationLogs = await enhancedTakealotLogger.getRecentLogs(adminId, integrationId, {
        limit: 50,
        since
      });

      recentLogs = operationLogs.filter(log => log.proxyUsed).map(log => ({
        operation: log.operation,
        operationType: log.operationType,
        status: log.status,
        message: log.message,
        proxyUsed: log.proxyUsed,
        duration: log.duration,
        recordsProcessed: log.recordsProcessed,
        timestamp: log.timestamp
      }));
    }

    // Calculate additional metrics
    const enhancedStats = {
      ...stats,
      timeRange,
      since: since.toISOString(),
      healthScore: stats.totalRequests > 0 ? Math.round(stats.successRate) : 100,
      performanceRating: stats.averageResponseTime < 2000 ? 'Excellent' :
                         stats.averageResponseTime < 5000 ? 'Good' :
                         stats.averageResponseTime < 10000 ? 'Fair' : 'Poor',
      recommendations: generateRecommendations(stats)
    };

    console.log('[ProxyStats] Generated stats:', enhancedStats);

    return NextResponse.json({
      success: true,
      stats: enhancedStats,
      recentLogs: includeDetailedLogs ? recentLogs : undefined,
      generatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[ProxyStats] Error getting proxy stats:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get proxy statistics',
      message: error.message
    }, { status: 500 });
  }
}

function generateRecommendations(stats: any): string[] {
  const recommendations = [];

  if (stats.successRate < 80) {
    recommendations.push('Low success rate detected. Consider checking proxy health or rotating to different proxies.');
  }

  if (stats.averageResponseTime > 5000) {
    recommendations.push('High response times detected. Consider using proxies closer to your target region.');
  }

  if (stats.uniqueProxiesUsed < 3 && stats.totalRequests > 10) {
    recommendations.push('Limited proxy rotation detected. Enable more proxies for better distribution.');
  }

  if (stats.totalRequests > 100 && stats.successRate > 95) {
    recommendations.push('Excellent proxy performance! Current configuration is working well.');
  }

  if (stats.totalRequests === 0) {
    recommendations.push('No proxy usage detected in the selected time range. Check if sync operations are running.');
  }

  return recommendations;
}
