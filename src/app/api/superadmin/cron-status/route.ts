import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching cron status...');
    
    // For development - return mock data until Firebase indexes are configured
    const mockCronStatus = {
      success: true,
      cronJobs: [
        {
          name: 'takealot-robust-hourly',
          schedule: 'Every hour',
          isActive: true,
          status: 'waiting',
          lastExecution: {
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            success: true,
            duration: 45000,
            itemsProcessed: 150
          },
          executions24h: 23,
          errors24h: 0,
          avgDuration: 42000,
          successRate: 100,
          nextExpectedRun: new Date(Date.now() + 30 * 60 * 1000),
          health: 'healthy'
        },
        {
          name: 'takealot-paginated-daily',
          schedule: 'Every 2 hours',
          isActive: true,
          status: 'success',
          lastExecution: {
            timestamp: new Date(Date.now() - 45 * 60 * 1000),
            success: true,
            duration: 78000,
            itemsProcessed: 320
          },
          executions24h: 12,
          errors24h: 0,
          avgDuration: 76000,
          successRate: 100,
          nextExpectedRun: new Date(Date.now() + 75 * 60 * 1000),
          health: 'healthy'
        },
        {
          name: 'calculate-product-metrics',
          schedule: 'Every 6 hours',
          isActive: true,
          status: 'waiting',
          lastExecution: {
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
            success: true,
            duration: 125000,
            itemsProcessed: 89
          },
          executions24h: 4,
          errors24h: 0,
          avgDuration: 120000,
          successRate: 100,
          nextExpectedRun: new Date(Date.now() + 3 * 60 * 60 * 1000),
          health: 'healthy'
        },
        {
          name: 'takealot-6month-sales',
          schedule: 'Twice daily',
          isActive: true,
          status: 'success',
          lastExecution: {
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
            success: true,
            duration: 156000,
            itemsProcessed: 245
          },
          executions24h: 2,
          errors24h: 0,
          avgDuration: 150000,
          successRate: 100,
          nextExpectedRun: new Date(Date.now() + 6 * 60 * 60 * 1000),
          health: 'healthy'
        }
      ],
      summary: {
        totalJobs: 4,
        activeJobs: 4,
        healthyJobs: 4,
        totalExecutions24h: 41,
        totalErrors24h: 0,
        overallSuccessRate: 100
      },
      lastUpdated: new Date(),
      note: 'Mock data for development - will show real data when deployed to Vercel with proper Firebase indexes'
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
