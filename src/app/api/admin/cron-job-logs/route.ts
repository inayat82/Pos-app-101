// src/app/api/admin/cron-job-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cronJobLogger } from '@/lib/cronJobLogger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') as any;
    const cronJobName = searchParams.get('cronJobName');
    const integrationId = searchParams.get('integrationId');
    const adminId = searchParams.get('adminId'); // Get adminId from query params
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    // Require both adminId and integrationId for security
    if (!adminId || !integrationId) {
      return NextResponse.json(
        { success: false, message: 'AdminId and integrationId are required' },
        { status: 400 }
      );
    }
    
    // Get logs for this admin only, optionally filtered by integrationId
    const result = await cronJobLogger.getAdminLogs(adminId, {
      limit,
      offset,
      status,
      cronJobName: cronJobName || undefined,
      integrationId: integrationId || undefined, // Pass integrationId to filter
      startDate,
      endDate
    });

    return NextResponse.json({
      success: true,
      logs: result.logs,
      total: result.total,
      hasMore: result.hasMore,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore: result.hasMore
      },
      adminId,
      integrationId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching admin cron job logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch cron job logs',
        error: error.message 
      },
      { status: 500 }
    );
  }
}
