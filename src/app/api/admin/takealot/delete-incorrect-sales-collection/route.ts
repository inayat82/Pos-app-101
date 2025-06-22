// src/app/api/admin/takealot/delete-incorrect-sales-collection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import '@/lib/firebase/firebaseAdmin'; // Initialize Firebase Admin SDK

async function deleteCollection(request: NextRequest) {
  try {
    // Handle both query params and body
    const { searchParams } = new URL(request.url);
    let confirmDelete = searchParams.get('confirm');
    
    // If not in query params, check request body
    if (!confirmDelete) {
      try {
        const body = await request.json();
        confirmDelete = body.confirm;
      } catch (e) {
        // Body might not be JSON, that's ok
      }
    }
      if (confirmDelete !== 'DELETE_takealotSales' && confirmDelete !== 'true') {
      return NextResponse.json({ 
        error: 'Missing confirmation parameter. Use ?confirm=DELETE_takealotSales or {"confirm": "true"} in body.',
        warning: 'This will permanently delete the takealotSales collection (mock data).' 
      }, { status: 400 });
    }

    const db = admin.firestore();
    
    // Get all documents in the takealotSales collection
    const collectionRef = db.collection('takealotSales');
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'Collection takealotSales is already empty or does not exist.',
        documentsDeleted: 0
      });
    }

    console.log(`Found ${snapshot.size} documents in takealotSales collection to delete`);
    
    // Delete documents in batches
    const batchSize = 100;
    let deletedCount = 0;
    
    const batches = [];
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = snapshot.docs.slice(i, i + batchSize);
      
      batchDocs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      batches.push(batch);
    }
    
    // Execute all batches
    for (const batch of batches) {
      await batch.commit();
      deletedCount += batchSize;
      console.log(`Deleted batch, total so far: ${Math.min(deletedCount, snapshot.size)}`);
    }
      return NextResponse.json({
      success: true,
      message: `Successfully deleted takealotSales collection (mock data collection)`,
      documentsDeleted: snapshot.size,
      note: 'Only the correct takealot_sales collection (real Takealot API data) remains'
    });

  } catch (error: any) {
    console.error('Error deleting takealotSales collection:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  return deleteCollection(request);
}

export async function POST(request: NextRequest) {
  return deleteCollection(request);
}
