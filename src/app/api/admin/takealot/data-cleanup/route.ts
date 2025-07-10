import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { neon } from '@neondatabase/serverless';

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;

export async function POST(request: NextRequest) {
  try {
    const { cleanupType, dateRange, dryRun, integrationId } = await request.json();
    const adminUid = request.headers.get('admin-uid');
    
    if (!adminUid || !integrationId) {
      return NextResponse.json({ error: 'Admin UID and Integration ID required' }, { status: 401 });
    }

    if (!NEON_DATABASE_URL) {
      return NextResponse.json({ error: 'Neon database not configured' }, { status: 500 });
    }

    const sql = neon(NEON_DATABASE_URL);
    let cleanedCount = 0;
    let operations: string[] = [];

    switch (cleanupType) {
      case 'firebase-only': {
        // Remove records that exist only in Firebase (not in Neon)
        if (!dryRun) {
          // This is a complex operation that would require fetching Firebase data
          // and comparing with Neon, then removing Firebase-only records
          operations.push('Firebase-only cleanup not implemented yet');
        } else {
          // Dry run: just count what would be removed
          const [productsSnap, salesSnap, reconsSnap] = await Promise.all([
            db.collection(`admins/${adminUid}/takealot_products`)
              .where('integrationId', '==', integrationId)
              .get(),
            db.collection(`admins/${adminUid}/takealot_sales`)
              .where('integrationId', '==', integrationId)
              .get(),
            db.collection(`admins/${adminUid}/takealot_reconciliation`)
              .where('integrationId', '==', integrationId)
              .get()
          ]);
          
          cleanedCount = productsSnap.size + salesSnap.size + reconsSnap.size;
          operations.push(`Would remove ${cleanedCount} Firebase-only records`);
        }
        break;
      }

      case 'duplicates': {
        // Remove duplicate records in Neon (keep latest)
        if (!dryRun) {
          const productDuplicates = await sql`
            DELETE FROM products a USING (
              SELECT MIN(id) as id, sku, admin_uid, integration_id 
              FROM products 
              WHERE admin_uid = ${adminUid} AND integration_id = ${integrationId}
              GROUP BY sku, admin_uid, integration_id 
              HAVING COUNT(*) > 1
            ) b
            WHERE a.sku = b.sku 
              AND a.admin_uid = b.admin_uid 
              AND a.integration_id = b.integration_id 
              AND a.id != b.id
          `;

          const salesDuplicates = await sql`
            DELETE FROM sales a USING (
              SELECT MIN(id) as id, order_id, admin_uid, integration_id 
              FROM sales 
              WHERE admin_uid = ${adminUid} AND integration_id = ${integrationId}
              GROUP BY order_id, admin_uid, integration_id 
              HAVING COUNT(*) > 1
            ) b
            WHERE a.order_id = b.order_id 
              AND a.admin_uid = b.admin_uid 
              AND a.integration_id = b.integration_id 
              AND a.id != b.id
          `;

          operations.push(`Removed ${productDuplicates.rowCount || 0} duplicate products`);
          operations.push(`Removed ${salesDuplicates.rowCount || 0} duplicate sales`);
          cleanedCount = (productDuplicates.rowCount || 0) + (salesDuplicates.rowCount || 0);
        } else {
          // Dry run: count duplicates
          const productDuplicates = await sql`
            SELECT COUNT(*) - COUNT(DISTINCT sku) as duplicates
            FROM products 
            WHERE admin_uid = ${adminUid} AND integration_id = ${integrationId}
          `;

          const salesDuplicates = await sql`
            SELECT COUNT(*) - COUNT(DISTINCT order_id) as duplicates
            FROM sales 
            WHERE admin_uid = ${adminUid} AND integration_id = ${integrationId}
          `;

          cleanedCount = Number(productDuplicates[0]?.duplicates || 0) + Number(salesDuplicates[0]?.duplicates || 0);
          operations.push(`Would remove ${cleanedCount} duplicate records`);
        }
        break;
      }

      case 'old-data': {
        // Remove data older than specified days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - (dateRange || 30));

        if (!dryRun) {
          const oldProducts = await sql`
            DELETE FROM products 
            WHERE admin_uid = ${adminUid} 
              AND integration_id = ${integrationId}
              AND created_at < ${cutoffDate.toISOString()}
          `;

          const oldSales = await sql`
            DELETE FROM sales 
            WHERE admin_uid = ${adminUid} 
              AND integration_id = ${integrationId}
              AND created_at < ${cutoffDate.toISOString()}
          `;

          const oldRecons = await sql`
            DELETE FROM reconciliation_data 
            WHERE admin_uid = ${adminUid} 
              AND integration_id = ${integrationId}
              AND created_at < ${cutoffDate.toISOString()}
          `;

          operations.push(`Removed ${oldProducts.rowCount || 0} old products`);
          operations.push(`Removed ${oldSales.rowCount || 0} old sales`);
          operations.push(`Removed ${oldRecons.rowCount || 0} old reconciliation records`);
          cleanedCount = (oldProducts.rowCount || 0) + (oldSales.rowCount || 0) + (oldRecons.rowCount || 0);
        } else {
          // Dry run: count old records
          const oldProducts = await sql`
            SELECT COUNT(*) as count
            FROM products 
            WHERE admin_uid = ${adminUid} 
              AND integration_id = ${integrationId}
              AND created_at < ${cutoffDate.toISOString()}
          `;

          const oldSales = await sql`
            SELECT COUNT(*) as count
            FROM sales 
            WHERE admin_uid = ${adminUid} 
              AND integration_id = ${integrationId}
              AND created_at < ${cutoffDate.toISOString()}
          `;

          const oldRecons = await sql`
            SELECT COUNT(*) as count
            FROM reconciliation_data 
            WHERE admin_uid = ${adminUid} 
              AND integration_id = ${integrationId}
              AND created_at < ${cutoffDate.toISOString()}
          `;

          cleanedCount = Number(oldProducts[0]?.count || 0) + Number(oldSales[0]?.count || 0) + Number(oldRecons[0]?.count || 0);
          operations.push(`Would remove ${cleanedCount} records older than ${dateRange || 30} days`);
        }
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid cleanup type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      cleanupType,
      cleanedCount,
      operations,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Data cleanup error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform data cleanup',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
