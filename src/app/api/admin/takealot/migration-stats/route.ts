import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { neon } from '@neondatabase/serverless';

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');
    const adminUid = request.headers.get('admin-uid');
    
    if (!adminUid || !integrationId) {
      return NextResponse.json({ error: 'Admin UID and Integration ID required' }, { status: 401 });
    }

    if (!NEON_DATABASE_URL) {
      return NextResponse.json({ error: 'Neon database not configured' }, { status: 500 });
    }

    const sql = neon(NEON_DATABASE_URL);

    // Get Neon record counts
    const neonProducts = await sql`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE admin_uid = ${adminUid} AND integration_id = ${integrationId}
    `;
    
    const neonSales = await sql`
      SELECT COUNT(*) as count 
      FROM sales 
      WHERE admin_uid = ${adminUid} AND integration_id = ${integrationId}
    `;

    const neonRecons = await sql`
      SELECT COUNT(*) as count 
      FROM reconciliation_data 
      WHERE admin_uid = ${adminUid} AND integration_id = ${integrationId}
    `;

    const neonRecordCount = 
      Number(neonProducts[0]?.count || 0) + 
      Number(neonSales[0]?.count || 0) + 
      Number(neonRecons[0]?.count || 0);

    // Get Firebase record counts
    let firebaseRecordCount = 0;
    try {
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

      firebaseRecordCount = productsSnap.size + salesSnap.size + reconsSnap.size;
    } catch (error) {
      console.error('Firebase count error:', error);
    }

    // Check for potential duplicates (same ID in both systems)
    const duplicateProducts = await sql`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE admin_uid = ${adminUid} 
        AND integration_id = ${integrationId}
        AND firebase_synced = true
    `;

    const duplicateSales = await sql`
      SELECT COUNT(*) as count 
      FROM sales 
      WHERE admin_uid = ${adminUid} 
        AND integration_id = ${integrationId}
        AND firebase_synced = true
    `;

    const duplicateRecons = await sql`
      SELECT COUNT(*) as count 
      FROM reconciliation_data 
      WHERE admin_uid = ${adminUid} 
        AND integration_id = ${integrationId}
        AND firebase_synced = true
    `;

    const duplicateRecords = 
      Number(duplicateProducts[0]?.count || 0) + 
      Number(duplicateSales[0]?.count || 0) + 
      Number(duplicateRecons[0]?.count || 0);

    const totalRecords = neonRecordCount + firebaseRecordCount;
    const migrationProgress = totalRecords > 0 ? Math.round((neonRecordCount / totalRecords) * 100) : 100;

    // Get last migration date from Neon metadata
    const migrationInfo = await sql`
      SELECT created_at 
      FROM products 
      WHERE admin_uid = ${adminUid} AND integration_id = ${integrationId}
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    const lastMigrationDate = migrationInfo[0]?.created_at || null;

    return NextResponse.json({
      totalRecords,
      neonRecords: neonRecordCount,
      firebaseRecords: firebaseRecordCount,
      duplicateRecords,
      migrationProgress,
      lastMigrationDate,
      breakdown: {
        neon: {
          products: Number(neonProducts[0]?.count || 0),
          sales: Number(neonSales[0]?.count || 0),
          reconciliation: Number(neonRecons[0]?.count || 0)
        },
        duplicates: {
          products: Number(duplicateProducts[0]?.count || 0),
          sales: Number(duplicateSales[0]?.count || 0),
          reconciliation: Number(duplicateRecons[0]?.count || 0)
        }
      }
    });

  } catch (error) {
    console.error('Migration stats error:', error);
    return NextResponse.json({ 
      error: 'Failed to get migration stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
