import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching cron status...');
    
    // For development - return mock data with proper structure
    const mockCronStatus = {
      success: true,
      systemHealth: {
        totalCronJobs: 4,
        healthyCronJobs: 4,
        overdueCronJobs: 0,
        unhealthyCronJobs: 0,
        activeJobs: 4,
        enabledIntegrations: 12,
        totalExecutions24h: 41,
        totalErrors24h: 0,
        overallSuccessRate: 100,
        lastSystemCheck: new Date().toISOString()
      },
      cronJobs: [
        {
          name: 'takealot-robust-hourly',
          schedule: 'Every hour',
          expected_interval_minutes: 60,
          endpoint: '/api/cron/takealot-robust-hourly',
          description: 'Robust hourly product sync',
          cronExpression: '0 * * * *',
          isActive: true,
          status: 'healthy',
          lastExecution: new Date(Date.now() - 2 * 60 * 60 * 1000),
          executions24h: 23,
          errors24h: 0,
          successRate: 100,
          isOverdue: false,
          nextExpectedRun: new Date(Date.now() + 30 * 60 * 1000),
          lastError: null
        },
        {
          name: 'takealot-paginated-daily',
          schedule: 'Every 2 hours',
          expected_interval_minutes: 120,
          endpoint: '/api/cron/takealot-paginated-daily',
          description: 'Paginated daily sync',
          cronExpression: '0 */2 * * *',
          isActive: true,
          status: 'healthy',
          lastExecution: new Date(Date.now() - 45 * 60 * 1000),
          executions24h: 12,
          errors24h: 0,
          successRate: 100,
          isOverdue: false,
          nextExpectedRun: new Date(Date.now() + 75 * 60 * 1000),
          lastError: null
        },
        {
          name: 'calculate-product-metrics',
          schedule: 'Every 6 hours',
          expected_interval_minutes: 360,
          endpoint: '/api/cron/calculate-product-metrics',
          description: 'Calculate product performance metrics',
          cronExpression: '0 */6 * * *',
          isActive: true,
          status: 'healthy',
          lastExecution: new Date(Date.now() - 3 * 60 * 60 * 1000),
          executions24h: 4,
          errors24h: 0,
          successRate: 100,
          isOverdue: false,
          nextExpectedRun: new Date(Date.now() + 3 * 60 * 60 * 1000),
          lastError: null
        },
        {
          name: 'cleanup-old-logs',
          schedule: 'Daily at 2 AM',
          expected_interval_minutes: 1440,
          endpoint: '/api/cron/cleanup-old-logs',
          description: 'Clean up old log entries',
          cronExpression: '0 2 * * *',
          isActive: true,
          status: 'healthy',
          lastExecution: new Date(Date.now() - 18 * 60 * 60 * 1000),
          executions24h: 1,
          errors24h: 0,
          successRate: 100,
          isOverdue: false,
          nextExpectedRun: new Date(Date.now() + 6 * 60 * 60 * 1000),
          lastError: null
        }
      ],
      databaseHealth: {
        status: 'healthy',
        connectionStatus: 'connected',
        responseTime: 120,
        connections: 15,
        lastCheck: new Date().toISOString(),
        lastSuccessfulWrite: new Date().toISOString(),
        collections: {
          'logs': 'accessible',
          'users': 'accessible',
          'takealotIntegrations': 'accessible'
        }
      },
      performanceData: {
        avgResponseTime: 340,
        p95ResponseTime: 890,
        errorRate: 0.002,
        requestsPerMinute: 45,
        totalItemsProcessed24h: 15420,
        totalPagesProcessed24h: 287,
        avgProcessingTime: 42000
      }
    };

    console.log('Returning mock cron status data');
    return NextResponse.json(mockCronStatus);

  } catch (error: any) {
    console.error('Error fetching cron status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch cron status',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
