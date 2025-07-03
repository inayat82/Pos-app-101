// src/app/api/superadmin/admin-cron-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h';
    
    // Mock data matching the AdminCronResponse interface
    const mockAdminAnalysis = [
      {
        adminId: 'admin-001',
        adminName: 'John Smith',
        adminEmail: 'john@example.com',
        integrationCount: 3,
        enabledIntegrations: 3,
        healthStatus: 'healthy' as const,
        metrics: {
          totalSyncs: 156,
          totalErrors: 3,
          successRate: 98.1,
          totalItemsProcessed: 4250,
          totalPagesProcessed: 89,
          avgProcessingTime: 45000,
          lastSyncTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
          hoursSinceLastSync: 2
        },
        cronJobFrequency: {
          'takealot-robust-hourly': { count: 23, errors: 1, lastRun: new Date(Date.now() - 1 * 60 * 60 * 1000) },
          'takealot-paginated-daily': { count: 12, errors: 0, lastRun: new Date(Date.now() - 45 * 60 * 1000) },
          'calculate-product-metrics': { count: 4, errors: 0, lastRun: new Date(Date.now() - 3 * 60 * 60 * 1000) }
        },
        recentErrors: [
          { timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), message: 'Timeout connecting to Takealot API', cronJob: 'takealot-robust-hourly' }
        ],
        integrations: [
          { id: 'int-001', accountName: 'Main Store', cronEnabled: true, lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000) },
          { id: 'int-002', accountName: 'Electronics', cronEnabled: true, lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000) },
          { id: 'int-003', accountName: 'Fashion', cronEnabled: true, lastSync: new Date(Date.now() - 3 * 60 * 60 * 1000) }
        ]
      },
      {
        adminId: 'admin-002',
        adminName: 'Sarah Johnson',
        adminEmail: 'sarah@example.com',
        integrationCount: 2,
        enabledIntegrations: 2,
        healthStatus: 'healthy' as const,
        metrics: {
          totalSyncs: 89,
          totalErrors: 0,
          successRate: 100,
          totalItemsProcessed: 2890,
          totalPagesProcessed: 45,
          avgProcessingTime: 32000,
          lastSyncTime: new Date(Date.now() - 30 * 60 * 1000),
          hoursSinceLastSync: 0.5
        },
        cronJobFrequency: {
          'takealot-robust-hourly': { count: 23, errors: 0, lastRun: new Date(Date.now() - 30 * 60 * 1000) },
          'takealot-paginated-daily': { count: 12, errors: 0, lastRun: new Date(Date.now() - 1 * 60 * 60 * 1000) }
        },
        recentErrors: [],
        integrations: [
          { id: 'int-004', accountName: 'Books & Media', cronEnabled: true, lastSync: new Date(Date.now() - 30 * 60 * 1000) },
          { id: 'int-005', accountName: 'Home & Garden', cronEnabled: true, lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000) }
        ]
      },
      {
        adminId: 'admin-003',
        adminName: 'Mike Wilson',
        adminEmail: 'mike@example.com',
        integrationCount: 5,
        enabledIntegrations: 4,
        healthStatus: 'warning' as const,
        metrics: {
          totalSyncs: 234,
          totalErrors: 12,
          successRate: 94.9,
          totalItemsProcessed: 6100,
          totalPagesProcessed: 156,
          avgProcessingTime: 67000,
          lastSyncTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
          hoursSinceLastSync: 6
        },
        cronJobFrequency: {
          'takealot-robust-hourly': { count: 23, errors: 2, lastRun: new Date(Date.now() - 6 * 60 * 60 * 1000) },
          'takealot-paginated-daily': { count: 12, errors: 1, lastRun: new Date(Date.now() - 4 * 60 * 60 * 1000) },
          'calculate-product-metrics': { count: 4, errors: 0, lastRun: new Date(Date.now() - 8 * 60 * 60 * 1000) }
        },
        recentErrors: [
          { timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), message: 'API rate limit exceeded', cronJob: 'takealot-robust-hourly' },
          { timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), message: 'Invalid product data format', cronJob: 'takealot-paginated-daily' }
        ],
        integrations: [
          { id: 'int-006', accountName: 'Sports Equipment', cronEnabled: true, lastSync: new Date(Date.now() - 6 * 60 * 60 * 1000) },
          { id: 'int-007', accountName: 'Automotive', cronEnabled: true, lastSync: new Date(Date.now() - 4 * 60 * 60 * 1000) },
          { id: 'int-008', accountName: 'Beauty', cronEnabled: false, lastSync: new Date(Date.now() - 12 * 60 * 60 * 1000) },
          { id: 'int-009', accountName: 'Toys & Games', cronEnabled: true, lastSync: new Date(Date.now() - 5 * 60 * 60 * 1000) },
          { id: 'int-010', accountName: 'Health', cronEnabled: true, lastSync: new Date(Date.now() - 7 * 60 * 60 * 1000) }
        ]
      }
    ];

    const systemStats = {
      totalAdmins: mockAdminAnalysis.length,
      healthyAdmins: mockAdminAnalysis.filter(a => a.healthStatus === 'healthy').length,
      warningAdmins: mockAdminAnalysis.filter(a => a.healthStatus === 'warning').length,
      unhealthyAdmins: mockAdminAnalysis.filter(a => a.healthStatus === 'unhealthy').length,
      criticalAdmins: mockAdminAnalysis.filter(a => a.healthStatus === 'critical').length,
      noDataAdmins: mockAdminAnalysis.filter(a => a.healthStatus === 'no_data').length,
      totalIntegrations: mockAdminAnalysis.reduce((sum, a) => sum + a.integrationCount, 0),
      totalEnabledIntegrations: mockAdminAnalysis.reduce((sum, a) => sum + a.enabledIntegrations, 0),
      totalSyncs: mockAdminAnalysis.reduce((sum, a) => sum + a.metrics.totalSyncs, 0),
      totalErrors: mockAdminAnalysis.reduce((sum, a) => sum + a.metrics.totalErrors, 0),
      overallSuccessRate: mockAdminAnalysis.reduce((sum, a) => sum + a.metrics.successRate, 0) / mockAdminAnalysis.length
    };

    return NextResponse.json({
      success: true,
      timeRange,
      systemStats,
      adminAnalysis: mockAdminAnalysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Admin Cron Analysis] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch admin cron analysis',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
