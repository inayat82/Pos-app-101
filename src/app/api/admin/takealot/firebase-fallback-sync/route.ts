// src/app/api/admin/takealot/firebase-fallback-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { DualWriteService } from '@/lib/dualWriteService';

export async function POST(request: NextRequest) {
  try {
    const { integrationId, dataType, records, adminId, originalStrategy } = await request.json();

    if (!integrationId || !dataType || !records || !adminId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: integrationId, dataType, records, adminId'
      }, { status: 400 });
    }

    console.log(`[Firebase Fallback] Explicit Firebase fallback for ${integrationId}, ${dataType}, strategy: ${originalStrategy}`);

    // Initialize dual-write service for explicit Firebase write
    const dualWriteService = new DualWriteService(adminId, integrationId, dataType);
    
    // Perform explicit Firebase write
    const result = await dualWriteService.writeToFirebaseExplicit(records);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Data successfully written to Firebase as fallback`,
        recordsWritten: result.firebaseRecordsWritten,
        strategy: 'firebase-fallback',
        result: {
          totalProcessed: result.recordsProcessed,
          firebaseRecords: result.firebaseRecordsWritten,
          strategy: result.strategy,
          warnings: result.warnings
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Firebase fallback failed',
        error: result.errors.join(', '),
        details: result
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Firebase fallback sync error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Firebase fallback sync failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
