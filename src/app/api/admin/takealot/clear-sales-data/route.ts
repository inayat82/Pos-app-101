// src/app/api/admin/takealot/clear-sales-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { integrationId } = await request.json();

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      );
    }

    // Get all sales documents for this integration
    const salesRef = collection(db, 'takealot_sales');
    const salesQuery = query(salesRef, where('integrationId', '==', integrationId));
    const salesSnapshot = await getDocs(salesQuery);

    if (salesSnapshot.empty) {
      return NextResponse.json({
        message: 'No sales data found to clear',
        deletedCount: 0
      });
    }

    // Delete sales data in batches (Firestore batch limit is 500)
    const batchSize = 500;
    const totalDocs = salesSnapshot.docs.length;
    let deletedCount = 0;

    for (let i = 0; i < salesSnapshot.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = salesSnapshot.docs.slice(i, i + batchSize);

      batchDocs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deletedCount += batchDocs.length;
    }

    // Log the operation
    const logData = {
      integrationId,
      operation: 'Clear All Sales Data',
      type: 'sales',
      trigger: 'Manual Action',
      recordsDeleted: deletedCount,
      status: 'success',
      createdAt: new Date(),
      duration: 0 // Will be calculated on the client side if needed
    };

    try {
      await fetch('/api/admin/takealot/log-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      });
    } catch (logError) {
      console.error('Failed to log operation:', logError);
      // Don't fail the main operation if logging fails
    }

    return NextResponse.json({
      message: `Successfully cleared ${deletedCount} sales records`,
      deletedCount
    });

  } catch (error: any) {
    console.error('Error clearing sales data:', error);
    return NextResponse.json(
      { error: `Failed to clear sales data: ${error.message}` },
      { status: 500 }
    );
  }
}
