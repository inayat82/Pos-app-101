// src/app/api/admin/takealot/load-sync-preferences/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  console.log('[LoadSyncPreferences] API endpoint called');
  try {
    const { integrationId, adminId } = await request.json();

    console.log('[LoadSyncPreferences] Request data:', { integrationId, adminId });

    if (!integrationId || !adminId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Integration ID and Admin ID are required' 
      }, { status: 400 });
    }

    // Verify integration ownership
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({ 
        success: false, 
        error: 'Integration not found' 
      }, { status: 404 });
    }

    const integrationData = integrationDoc.data();
    if (integrationData?.adminId !== adminId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized access to this integration' 
      }, { status: 403 });
    }

    // Connect to Neon database
    const pool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    
    try {
      // Load sync preferences from Neon
      const result = await client.query(`
        SELECT preference_type, strategies, updated_at
        FROM takealot_sync_preferences
        WHERE admin_uid = $1 AND integration_id = $2
        ORDER BY updated_at DESC
      `, [adminId, integrationId]);

      const preferences = {
        salesStrategies: null,
        productStrategies: null,
        lastUpdated: null
      };

      result.rows.forEach(row => {
        if (row.preference_type === 'sales') {
          preferences.salesStrategies = row.strategies;
          preferences.lastUpdated = row.updated_at;
        } else if (row.preference_type === 'products') {
          preferences.productStrategies = row.strategies;
          if (!preferences.lastUpdated || row.updated_at > preferences.lastUpdated) {
            preferences.lastUpdated = row.updated_at;
          }
        }
      });

      console.log('[LoadSyncPreferences] Successfully loaded sync preferences from Neon:', {
        hasSales: !!preferences.salesStrategies,
        hasProducts: !!preferences.productStrategies,
        lastUpdated: preferences.lastUpdated
      });

      return NextResponse.json({
        success: true,
        data: preferences,
        source: 'neon',
        foundRecords: result.rows.length
      });

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('[LoadSyncPreferences] Error loading sync preferences from Neon:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to load sync preferences from Neon',
      message: error.message
    }, { status: 500 });
  }
}
