// app/api/cron/[schedule]/route.ts
import { NextResponse } from 'next/server';
import { processSyncPreferencesForSchedule, getCronLabelFromSchedule } from '@/lib/takealotSyncService';

// This is a convention for Vercel Cron Jobs
// The path app/api/cron/[schedule]/route.ts will handle requests like /api/cron/hourly

export async function GET(
  request: Request,
  { params }: { params: { schedule: string } }
) {
  const scheduleParam = params.schedule; // e.g., 'hourly', 'nightly'
  const cronJobSecret = request.headers.get('authorization')?.split('Bearer ')?.[1];

  if (process.env.CRON_SECRET && cronJobSecret !== process.env.CRON_SECRET) {
    console.warn(`[Cron API] Unauthorized attempt to run schedule: ${scheduleParam}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cronLabel = getCronLabelFromSchedule(scheduleParam);

  if (!cronLabel) {
    console.error(`[Cron API] Invalid schedule parameter: ${scheduleParam}`);
    return NextResponse.json({ error: `Invalid schedule: ${scheduleParam}` }, { status: 400 });
  }

  try {
    console.info(`[Cron API] Received cron job for schedule: ${scheduleParam} (mapped to: ${cronLabel})`);
    const result = await processSyncPreferencesForSchedule(cronLabel);
    console.info(`[Cron API] Cron job for schedule ${scheduleParam} completed.`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[Cron API] Error processing cron job for schedule ${scheduleParam}:`, error);
    return NextResponse.json(
      { error: 'Failed to process cron job', details: error.message },
      { status: 500 }
    );
  }
}
