// src/app/api/admin/takealot/fix-duplicate-products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    console.log('Fix duplicate products endpoint called');
    
    const { integrationId } = await request.json() as {
      integrationId: string;
    };

    if (!integrationId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: integrationId' 
      }, { status: 400 });
    }

    // Create streaming response for progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const operationStartTime = Date.now();
        let totalProducts = 0;
        let duplicatesFound = 0;
        let duplicatesRemoved = 0;
        let uniqueProducts = 0;
        let errors = 0;

        try {
          // Send initial progress
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Starting duplicate product cleanup...',
            progress: 5,
            totalProducts: 0,
            duplicatesFound: 0,
            duplicatesRemoved: 0,
            uniqueProducts: 0,
            errors: 0,
            log: 'Initializing duplicate product removal process'
          })}\n\n`));

          // Get all products for this integration
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Fetching all products from database...',
            progress: 15,
            totalProducts,
            duplicatesFound,
            duplicatesRemoved,
            uniqueProducts,
            errors,
            log: 'Querying all products for duplicate analysis'
          })}\n\n`));

          const productsQuery = db.collection('takealot_offers')
            .where('integrationId', '==', integrationId);

          const productsSnapshot = await productsQuery.get();
          totalProducts = productsSnapshot.size;

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Found ${totalProducts} total products. Analyzing for duplicates...`,
            progress: 30,
            totalProducts,
            duplicatesFound,
            duplicatesRemoved,
            uniqueProducts,
            errors,
            log: `Loaded ${totalProducts} products for duplicate analysis`
          })}\n\n`));

          if (totalProducts === 0) {
            throw new Error('No products found for this integration');
          }

          // Group products by TSIN to identify duplicates
          const tsinGroups = new Map<string, any[]>();
          const productsWithoutTsin: any[] = [];

          productsSnapshot.forEach(doc => {
            const data = doc.data();
            const tsin = data.tsin_id || data.tsin;
            
            if (!tsin) {
              productsWithoutTsin.push({
                id: doc.id,
                data: data
              });
              return;
            }

            const tsinKey = tsin.toString();
            if (!tsinGroups.has(tsinKey)) {
              tsinGroups.set(tsinKey, []);
            }
            
            tsinGroups.get(tsinKey)!.push({
              id: doc.id,
              data: data,
              fetchedAt: data.fetchedAt || data.createdAt,
              lastUpdated: data.lastUpdated
            });
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Identifying duplicate products by TSIN...',
            progress: 50,
            totalProducts,
            duplicatesFound,
            duplicatesRemoved,
            uniqueProducts,
            errors,
            log: `Grouped products by TSIN. Found ${tsinGroups.size} unique TSINs`
          })}\n\n`));

          // Identify duplicates and keep the most recent one
          const duplicateDocIds: string[] = [];
          const keepDocIds: string[] = [];

          for (const [tsin, products] of tsinGroups) {
            if (products.length > 1) {
              duplicatesFound += products.length - 1; // Count duplicates (excluding the one we keep)
              
              // Sort by lastUpdated (most recent first), then by fetchedAt
              products.sort((a, b) => {
                const aDate = new Date(a.lastUpdated || a.fetchedAt || 0);
                const bDate = new Date(b.lastUpdated || b.fetchedAt || 0);
                return bDate.getTime() - aDate.getTime();
              });

              // Keep the most recent one, mark others for deletion
              keepDocIds.push(products[0].id);
              for (let i = 1; i < products.length; i++) {
                duplicateDocIds.push(products[i].id);
              }
            } else {
              // Single product, keep it
              keepDocIds.push(products[0].id);
            }
          }

          uniqueProducts = tsinGroups.size + productsWithoutTsin.length; // Unique TSINs + products without TSIN

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Found ${duplicatesFound} duplicate products. Starting removal...`,
            progress: 70,
            totalProducts,
            duplicatesFound,
            duplicatesRemoved,
            uniqueProducts,
            errors,
            log: `Identified ${duplicatesFound} duplicates across ${tsinGroups.size} TSINs`
          })}\n\n`));

          // Remove duplicates in batches
          if (duplicateDocIds.length > 0) {
            const batchSize = 500; // Firestore batch limit
            
            for (let i = 0; i < duplicateDocIds.length; i += batchSize) {
              const batch = db.batch();
              const batchDocIds = duplicateDocIds.slice(i, i + batchSize);
              
              for (const docId of batchDocIds) {
                const docRef = db.collection('takealot_offers').doc(docId);
                batch.delete(docRef);
              }
              
              try {
                await batch.commit();
                duplicatesRemoved += batchDocIds.length;
                
                const progress = 70 + Math.round((duplicatesRemoved / duplicatesFound) * 20);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  message: `Removed ${duplicatesRemoved}/${duplicatesFound} duplicates...`,
                  progress,
                  totalProducts,
                  duplicatesFound,
                  duplicatesRemoved,
                  uniqueProducts,
                  errors,
                  log: `Batch ${Math.ceil((i + batchSize) / batchSize)} completed: ${duplicatesRemoved} removed`
                })}\n\n`));
                
              } catch (batchError: any) {
                console.error(`Error removing batch starting at ${i}:`, batchError);
                errors += batchDocIds.length;
              }
            }
          }

          // Save operation log
          const operationEndTime = Date.now();
          const operationDuration = operationEndTime - operationStartTime;          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Getting final count of remaining records...',
            progress: 95,
            totalProducts,
            duplicatesFound,
            duplicatesRemoved,
            uniqueProducts,
            errors,
            log: 'Counting remaining records in database'
          })}\n\n`));

          // Get final count of remaining records from database
          const remainingQuery = db.collection('takealot_offers')
            .where('integrationId', '==', integrationId);
          const remainingSnapshot = await remainingQuery.get();
          const finalRemainingCount = remainingSnapshot.size;

          const logData = {
            integrationId,
            operation: 'Fix Duplicate Products',
            type: 'products',
            trigger: 'manual_cleanup',
            status: errors > 0 ? 'completed_with_errors' : 'success',
            recordsFetched: totalProducts,
            recordsNew: 0,
            recordsUpdated: 0,
            recordsSkipped: 0,
            recordsRemoved: duplicatesRemoved,
            totalRecords: totalProducts,
            duplicatesFound,
            duplicatesRemoved,
            uniqueRecordsRemaining: finalRemainingCount,
            recordsWithoutTsin: productsWithoutTsin.length,
            errors,
            duration: operationDuration,
            createdAt: new Date().toISOString(),
            dbUpdated: new Date().toISOString(),
            summary: {
              beforeCleanup: totalProducts,
              afterCleanup: finalRemainingCount,
              duplicatesRemoved,
              uniqueTsins: tsinGroups.size,
              recordsWithoutTsin: productsWithoutTsin.length,
              cleanupEfficiency: totalProducts > 0 ? Math.round((duplicatesRemoved / totalProducts) * 100) : 0
            }
          };

          // Save to fetch_logs for UI display (instead of cleanup_logs)
          await db.collection('fetch_logs').add(logData);

          // Send completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Cleanup completed - ${duplicatesRemoved} duplicates removed, ${finalRemainingCount} unique products remaining`,
            progress: 100,
            totalProducts,
            duplicatesFound,
            duplicatesRemoved,
            totalRemaining: finalRemainingCount,
            batchesProcessed: Math.ceil(duplicateDocIds.length / 500), // 500 is the batch size used
            errors,
            completed: true,
            success: true,
            summary: {
              beforeCleanup: totalProducts,
              afterCleanup: finalRemainingCount,
              duplicatesRemoved,
              uniqueTsins: tsinGroups.size,
              recordsWithoutTsin: productsWithoutTsin.length,
              cleanupEfficiency: totalProducts > 0 ? Math.round((duplicatesRemoved / totalProducts) * 100) : 0
            },
            log: `Completed: ${duplicatesRemoved} duplicates removed, ${finalRemainingCount} records remain in database`
          })}\n\n`));

        } catch (error: any) {
          console.error('Product cleanup error:', error);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: true,
            message: error.message,
            completed: true,
            totalProducts,
            duplicatesFound,
            duplicatesRemoved,
            uniqueProducts,
            errors: errors + 1,
            log: `Error: ${error.message}`
          })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Product cleanup initialization error:', error);
    
    return NextResponse.json({ 
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
