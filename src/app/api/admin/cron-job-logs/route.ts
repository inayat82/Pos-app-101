// src/app/api/admin/cron-job-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cronJobLogger } from '@/lib/cronJobLogger';
import { getUserAuth } from '@/lib/firebase/authUtils';

export async function GET(request: NextRequest) {
  try {
    // Get the current session to identify the admin
    const authResult = await getUserAuth();
    
    if (!authResult.session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminId = authResult.session.user.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') as any;
    const cronJobName = searchParams.get('cronJobName');
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    // Get logs for this admin only
    const result = await cronJobLogger.getAdminLogs(adminId, {
      limit,
      offset,
      status,
      cronJobName: cronJobName || undefined,
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
