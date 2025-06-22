// src/app/api/admin/takealot/fix-product-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, updateDoc, writeBatch } from 'firebase/firestore';

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
        message: 'No product data found to fix',
        fixedCount: 0
      });
    }

    let fixedCount = 0;
    const batchSize = 500;
    const totalDocs = productsSnapshot.docs.length;

    // Process products in batches
    for (let i = 0; i < productsSnapshot.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = productsSnapshot.docs.slice(i, i + batchSize);

      batchDocs.forEach((doc) => {
        const productData = doc.data();
        let needsUpdate = false;
        const updates: any = {};

        // Fix common data issues
        // 1. Ensure numeric fields are properly typed
        if (productData.price && typeof productData.price === 'string') {
          updates.price = parseFloat(productData.price) || 0;
          needsUpdate = true;
        }

        if (productData.stock && typeof productData.stock === 'string') {
          updates.stock = parseInt(productData.stock) || 0;
          needsUpdate = true;
        }

        // 2. Clean up null or undefined fields
        if (productData.title === null || productData.title === undefined) {
          updates.title = '';
          needsUpdate = true;
        }

        if (productData.description === null || productData.description === undefined) {
          updates.description = '';
          needsUpdate = true;
        }

        // 3. Ensure required fields exist
        if (!productData.sku || productData.sku.trim() === '') {
          updates.sku = productData.id || `SKU_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          needsUpdate = true;
        }

        // 4. Fix date fields
        if (productData.createdAt && typeof productData.createdAt === 'string') {
          updates.createdAt = new Date(productData.createdAt);
          needsUpdate = true;
        }

        if (productData.updatedAt && typeof productData.updatedAt === 'string') {
          updates.updatedAt = new Date(productData.updatedAt);
          needsUpdate = true;
        }

        // 5. Ensure integrationId is set
        if (!productData.integrationId) {
          updates.integrationId = integrationId;
          needsUpdate = true;
        }

        // 6. Add lastFixedAt timestamp
        updates.lastFixedAt = new Date();
        needsUpdate = true;

        if (needsUpdate) {
          batch.update(doc.ref, updates);
          fixedCount++;
        }
      });

      if (fixedCount > 0) {
        await batch.commit();
      }
    }

    // Log the operation
    const logData = {
      integrationId,
      operation: 'Fix All Product Data',
      type: 'products',
      trigger: 'Manual Action',
      recordsProcessed: totalDocs,
      recordsFixed: fixedCount,
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
      message: `Successfully processed ${totalDocs} products and fixed ${fixedCount} records`,
      totalProcessed: totalDocs,
      fixedCount
    });

  } catch (error: any) {
    console.error('Error fixing product data:', error);
    return NextResponse.json(
      { error: `Failed to fix product data: ${error.message}` },
      { status: 500 }
    );
  }
}
