// src/app/api/admin/takealot/remove-duplicate-sales/route.ts
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
        message: 'No sales data found',
        duplicatesRemoved: 0
      });
    }

    // Group sales by unique identifier (assuming orderId or similar)
    const salesMap = new Map();
    const duplicates: any[] = [];

    salesSnapshot.docs.forEach((doc) => {
      const salesData = doc.data();
      const uniqueKey = `${salesData.orderId || ''}_${salesData.orderItemId || ''}_${salesData.createdAt || ''}`;
      
      if (salesMap.has(uniqueKey)) {
        // This is a duplicate
        duplicates.push({
          id: doc.id,
          ref: doc.ref,
          data: salesData
        });
      } else {
        salesMap.set(uniqueKey, {
          id: doc.id,
          ref: doc.ref,
          data: salesData
        });
      }
    });

    if (duplicates.length === 0) {
      return NextResponse.json({
        message: 'No duplicate sales records found',
        duplicatesRemoved: 0
      });
    }

    // Delete duplicates in batches
    const batchSize = 500;
    let deletedCount = 0;

    for (let i = 0; i < duplicates.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDuplicates = duplicates.slice(i, i + batchSize);

      batchDuplicates.forEach((duplicate) => {
        batch.delete(duplicate.ref);
      });

      await batch.commit();
      deletedCount += batchDuplicates.length;
    }

    // Log the operation
    const logData = {
      integrationId,
      operation: 'Remove Duplicate Sales',
      type: 'sales',
      trigger: 'Manual Action',
      recordsDeleted: deletedCount,
      totalRecords: salesSnapshot.docs.length,
      uniqueRecords: salesMap.size,
      status: 'success',
      createdAt: new Date(),
      duration: 0
    };

    try {
      await fetch('/api/admin/takealot/log-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      });
    } catch (logError) {
      console.error('Failed to log operation:', logError);
    }

    return NextResponse.json({
      message: `Successfully removed ${deletedCount} duplicate sales records. ${salesMap.size} unique records remain.`,
      duplicatesRemoved: deletedCount,
      uniqueRecordsRemaining: salesMap.size
    });

  } catch (error: any) {
    console.error('Error removing duplicate sales:', error);
    return NextResponse.json(
      { error: `Failed to remove duplicate sales: ${error.message}` },
      { status: 500 }
    );
  }
}
