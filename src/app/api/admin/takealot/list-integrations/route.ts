// API endpoint to list available Takealot integrations for an admin
// src/app/api/admin/takealot/list-integrations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID is required' },
        { status: 400 }
      );
    }

    console.log(`[ListIntegrations] Fetching integrations for admin: ${adminId}`);

    // Fetch all integrations for this admin
    const integrationsSnapshot = await db
      .collection('takealotIntegrations')
      .where('adminId', '==', adminId)
      .get();

    const integrations = integrationsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        accountName: data.accountName || data.account_name || 'Unknown Account',
        adminId: data.adminId,
        apiKey: data.apiKey ? '***hidden***' : undefined,
        lastSync: data.lastSyncDate || data.lastSync || null,
        status: data.status || 'active',
        createdAt: data.createdAt || null
      };
    });

    console.log(`[ListIntegrations] Found ${integrations.length} integrations for admin ${adminId}`);

    return NextResponse.json({
      success: true,
      integrations,
      count: integrations.length
    });

  } catch (error) {
    console.error('[ListIntegrations] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch integrations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
