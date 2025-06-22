// src/app/api/admin/takealot/log-operation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const logData = await request.json();

    if (!logData.integrationId || !logData.operation) {
      return NextResponse.json(
        { error: 'Integration ID and operation are required' },
        { status: 400 }
      );
    }

    // Add the log entry to Firestore
    const logsRef = collection(db, 'takealotApiLogs');
    
    const logEntry = {
      ...logData,
      createdAt: serverTimestamp(),
      timestamp: new Date().toISOString()
    };

    await addDoc(logsRef, logEntry);

    return NextResponse.json({
      message: 'Operation logged successfully',
      logEntry
    });

  } catch (error: any) {
    console.error('Error logging operation:', error);
    return NextResponse.json(
      { error: `Failed to log operation: ${error.message}` },
      { status: 500 }
    );
  }
}
