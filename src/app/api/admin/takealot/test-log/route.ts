// src/app/api/admin/takealot/test-log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { integrationId } = await request.json();

    if (!integrationId) {
      return NextResponse.json({ error: 'Missing integrationId' }, { status: 400 });
    }

    console.log('Creating test log for integration:', integrationId);

    // Create a test log entry
    const testLogData = {
      integrationId,
      operation: 'Test Log Entry',
      type: 'test',
      trigger: 'manual',
      status: 'success',
      recordsFetched: 0,
      recordsSaved: 0,
      pagesFetched: 0,
      totalPages: 0,
      totalRecords: 0,
      duplicates: 0,
      errors: 0,
      duration: 1000,
      createdAt: new Date().toISOString(),
      message: 'This is a test log entry to verify database functionality'
    };

    console.log('Saving test log data:', testLogData);
    const logDoc = await db.collection('fetch_logs').add(testLogData);
    console.log('Test log created successfully with ID:', logDoc.id);

    return NextResponse.json({ 
      success: true, 
      logId: logDoc.id,
      message: 'Test log created successfully'
    });

  } catch (error: any) {
    console.error('Error creating test log:', error);
    return NextResponse.json({ 
      error: 'Failed to create test log', 
      details: error.message 
    }, { status: 500 });
  }
}
