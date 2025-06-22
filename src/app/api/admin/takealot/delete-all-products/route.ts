// src/app/api/admin/takealot/delete-all-products/route.ts
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

    // Get all product documents for this integration
    const productsRef = collection(db, 'takealotProducts');
    const productsQuery = query(productsRef, where('integrationId', '==', integrationId));
    const productsSnapshot = await getDocs(productsQuery);

    if (productsSnapshot.empty) {
      return NextResponse.json({
        message: 'No product data found to delete',
        deletedCount: 0
      });
    }

    // Delete products in batches (Firestore batch limit is 500)
    const batchSize = 500;
    const totalDocs = productsSnapshot.docs.length;
    let deletedCount = 0;

    for (let i = 0; i < productsSnapshot.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = productsSnapshot.docs.slice(i, i + batchSize);

      batchDocs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deletedCount += batchDocs.length;
    }

    // Log the operation
    const logData = {
      integrationId,
      operation: 'Delete All Products',
      type: 'products',
      trigger: 'Manual Action',
      recordsDeleted: deletedCount,
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
      message: `Successfully deleted ${deletedCount} product records`,
      deletedCount
    });

  } catch (error: any) {
    console.error('Error deleting products:', error);
    return NextResponse.json(
      { error: `Failed to delete products: ${error.message}` },
      { status: 500 }
    );
  }
}
