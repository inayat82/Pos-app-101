// src/app/api/admin/takealot/save-sync-preferences/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  console.log('[SaveSyncPreferences] API endpoint called');
  try {
    const { 
      integrationId, 
      adminId, 
      salesStrategies, 
      productStrategies,
      timestamp 
    } = await request.json();

    console.log('[SaveSyncPreferences] Request data:', { 
      integrationId, 
      adminId, 
      timestamp,
      salesCount: salesStrategies?.length,
      productCount: productStrategies?.length 
    });

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
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS takealot_sync_preferences (
          id SERIAL PRIMARY KEY,
          admin_uid VARCHAR(255) NOT NULL,
          integration_id VARCHAR(255) NOT NULL,
          preference_type VARCHAR(50) NOT NULL,
          strategies JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(admin_uid, integration_id, preference_type)
        )
      `);

      // Save sales strategies
      if (salesStrategies && salesStrategies.length > 0) {
        await client.query(`
          INSERT INTO takealot_sync_preferences (admin_uid, integration_id, preference_type, strategies)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (admin_uid, integration_id, preference_type)
          DO UPDATE SET 
            strategies = EXCLUDED.strategies,
            updated_at = CURRENT_TIMESTAMP
        `, [adminId, integrationId, 'sales', JSON.stringify(salesStrategies)]);
      }

      // Save product strategies
      if (productStrategies && productStrategies.length > 0) {
        await client.query(`
          INSERT INTO takealot_sync_preferences (admin_uid, integration_id, preference_type, strategies)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (admin_uid, integration_id, preference_type)
          DO UPDATE SET 
            strategies = EXCLUDED.strategies,
            updated_at = CURRENT_TIMESTAMP
        `, [adminId, integrationId, 'products', JSON.stringify(productStrategies)]);
      }

      console.log('[SaveSyncPreferences] Successfully saved sync preferences to Neon');

      return NextResponse.json({
        success: true,
        message: 'Sync preferences saved to Neon successfully',
        savedAt: new Date().toISOString()
      });

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('[SaveSyncPreferences] Error saving sync preferences to Neon:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to save sync preferences to Neon',
      message: error.message
    }, { status: 500 });
  }
}
