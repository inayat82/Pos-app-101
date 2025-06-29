// src/app/api/admin/takealot/fix-duplicate-sales/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    console.log('Fix duplicate sales endpoint called');
    
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
        let totalSales = 0;
        let duplicatesFound = 0;
        let duplicatesRemoved = 0;
        let uniqueSales = 0;
        let errors = 0;

        try {
          // Send initial progress
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Starting duplicate sales cleanup...',
            progress: 5,
            totalSales: 0,
            duplicatesFound: 0,
            duplicatesRemoved: 0,
            uniqueSales: 0,
            errors: 0,
            log: 'Initializing duplicate sales removal process'
          })}\n\n`));

          // Get all sales for this integration
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Fetching all sales from database...',
            progress: 15,
            totalSales,
            duplicatesFound,
            duplicatesRemoved,
            uniqueSales,
            errors,
            log: 'Querying all sales for duplicate analysis'
          })}\n\n`));

          const salesQuery = db.collection('takealot_sales')
            .where('integrationId', '==', integrationId);

          const salesSnapshot = await salesQuery.get();
          totalSales = salesSnapshot.size;

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Found ${totalSales} total sales. Analyzing for duplicates...`,
            progress: 30,
            totalSales,
            duplicatesFound,
            duplicatesRemoved,
            uniqueSales,
            errors,
            log: `Loaded ${totalSales} sales for duplicate analysis`
          })}\n\n`));

          if (totalSales === 0) {
            throw new Error('No sales found for this integration');
          }

          // Group sales by Order ID to identify duplicates
          const orderIdGroups = new Map<string, any[]>();
          const salesWithoutOrderId: any[] = [];

          salesSnapshot.forEach(doc => {
            const data = doc.data();
            const orderId = data.order_id || data.sale_id;
            
            if (!orderId) {
              salesWithoutOrderId.push({
                id: doc.id,
                data: data
              });
              return;
            }

            const orderKey = orderId.toString();
            if (!orderIdGroups.has(orderKey)) {
              orderIdGroups.set(orderKey, []);
            }
            
            orderIdGroups.get(orderKey)!.push({
              id: doc.id,
              data: data,
              fetchedAt: data.fetchedAt || data.createdAt,
              lastUpdated: data.lastUpdated
            });
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Identifying duplicate sales by Order ID...',
            progress: 50,
            totalSales,
            duplicatesFound,
            duplicatesRemoved,
            uniqueSales,
            errors,
            log: `Grouped sales by Order ID. Found ${orderIdGroups.size} unique orders`
          })}\n\n`));

          // Identify duplicates and keep the most recent one
          const duplicateDocIds: string[] = [];
          const keepDocIds: string[] = [];

          for (const [orderId, sales] of orderIdGroups) {
            if (sales.length > 1) {
              duplicatesFound += sales.length - 1; // Count duplicates (excluding the one we keep)
              
              // Sort by lastUpdated (most recent first), then by fetchedAt
              sales.sort((a, b) => {
                const aDate = new Date(a.lastUpdated || a.fetchedAt || 0);
                const bDate = new Date(b.lastUpdated || b.fetchedAt || 0);
                return bDate.getTime() - aDate.getTime();
              });

              // Keep the most recent one, mark others for deletion
              keepDocIds.push(sales[0].id);
              for (let i = 1; i < sales.length; i++) {
                duplicateDocIds.push(sales[i].id);
              }
            } else {
              // Single sale, keep it
              keepDocIds.push(sales[0].id);
            }
          }

          uniqueSales = orderIdGroups.size + salesWithoutOrderId.length; // Unique Order IDs + sales without Order ID

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Found ${duplicatesFound} duplicate sales. Starting removal...`,
            progress: 70,
            totalSales,
            duplicatesFound,
            duplicatesRemoved,
            uniqueSales,
            errors,
            log: `Identified ${duplicatesFound} duplicates across ${orderIdGroups.size} orders`
          })}\n\n`));

          // Remove duplicates in batches
          if (duplicateDocIds.length > 0) {
            const batchSize = 500; // Firestore batch limit
            
            for (let i = 0; i < duplicateDocIds.length; i += batchSize) {
              const batch = db.batch();
              const batchDocIds = duplicateDocIds.slice(i, i + batchSize);
              
              for (const docId of batchDocIds) {
                const docRef = db.collection('takealot_sales').doc(docId);
                batch.delete(docRef);
              }
              
              try {
                await batch.commit();
                duplicatesRemoved += batchDocIds.length;
                
                const progress = 70 + Math.round((duplicatesRemoved / duplicatesFound) * 20);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  message: `Removed ${duplicatesRemoved}/${duplicatesFound} duplicates...`,
                  progress,
                  totalSales,
                  duplicatesFound,
                  duplicatesRemoved,
                  uniqueSales,
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
            totalSales,
            duplicatesFound,
            duplicatesRemoved,
            uniqueSales,
            errors,
            log: 'Counting remaining records in database'
          })}\n\n`));

          // Get final count of remaining records from database
          const remainingQuery = db.collection('takealot_sales')
            .where('integrationId', '==', integrationId);
          const remainingSnapshot = await remainingQuery.get();
          const finalRemainingCount = remainingSnapshot.size;

          const logData = {
            integrationId,
            operation: 'Remove Duplicate Sales',
            type: 'sales',
            trigger: 'manual_cleanup',
            status: errors > 0 ? 'completed_with_errors' : 'success',
            recordsFetched: totalSales,
            recordsNew: 0,
            recordsUpdated: 0,
            recordsSkipped: 0,
            recordsRemoved: duplicatesRemoved,
            totalRecords: totalSales,
            duplicatesFound,
            duplicatesRemoved,
            uniqueRecordsRemaining: finalRemainingCount,
            recordsWithoutOrderId: salesWithoutOrderId.length,
            errors,
            duration: operationDuration,
            createdAt: new Date().toISOString(),
            dbUpdated: new Date().toISOString(),
            summary: {
              beforeCleanup: totalSales,
              afterCleanup: finalRemainingCount,
              duplicatesRemoved,
              uniqueOrderIds: orderIdGroups.size,
              recordsWithoutOrderId: salesWithoutOrderId.length,
              cleanupEfficiency: totalSales > 0 ? Math.round((duplicatesRemoved / totalSales) * 100) : 0
            }
          };

          // Legacy logging removed - now using centralized logging system

          // Send completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Cleanup completed - ${duplicatesRemoved} duplicates removed, ${finalRemainingCount} unique sales remaining`,
            progress: 100,
            totalSales,
            duplicatesFound,
            duplicatesRemoved,
            totalRemaining: finalRemainingCount,
            batchesProcessed: Math.ceil(duplicateDocIds.length / 500), // 500 is the batch size used
            errors,
            completed: true,
            success: true,
            summary: {
              beforeCleanup: totalSales,
              afterCleanup: finalRemainingCount,
              duplicatesRemoved,
              uniqueOrderIds: orderIdGroups.size,
              recordsWithoutOrderId: salesWithoutOrderId.length,
              cleanupEfficiency: totalSales > 0 ? Math.round((duplicatesRemoved / totalSales) * 100) : 0
            },
            log: `Completed: ${duplicatesRemoved} duplicates removed, ${finalRemainingCount} records remain in database`
          })}\n\n`));

        } catch (error: any) {
          console.error('Sales cleanup error:', error);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: true,
            message: error.message,
            completed: true,
            totalSales,
            duplicatesFound,
            duplicatesRemoved,
            uniqueSales,
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
    console.error('Sales cleanup initialization error:', error);
    
    return NextResponse.json({ 
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
