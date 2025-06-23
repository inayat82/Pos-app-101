// src/app/api/admin/takealot/sync-preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationId, adminId, salesStrategies, productStrategies } = body;

    if (!integrationId || !adminId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Save sync preferences
    const syncPrefsRef = dbAdmin
      .collection(`admins/${adminId}/takealotIntegrations/${integrationId}/syncPreferences`)
      .doc('preferences');

    await syncPrefsRef.set({
      salesStrategies,
      productStrategies,
      updatedAt: new Date(),
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Sync preferences saved successfully' 
    });

  } catch (error: any) {
    console.error('Error saving sync preferences:', error);
    return NextResponse.json({ 
      error: 'Failed to save sync preferences', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');
    const adminId = searchParams.get('adminId');

    if (!integrationId || !adminId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get sync preferences
    const syncPrefsRef = dbAdmin
      .collection(`admins/${adminId}/takealotIntegrations/${integrationId}/syncPreferences`)
      .doc('preferences');    const syncPrefsSnap = await syncPrefsRef.get();

    if (syncPrefsSnap.exists) {
      const data = syncPrefsSnap.data();
      return NextResponse.json({ 
        success: true, 
        data 
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        data: null,
        message: 'No preferences found' 
      });
    }

  } catch (error: any) {
    console.error('Error fetching sync preferences:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch sync preferences', 
      details: error.message 
    }, { status: 500 });
  }
}
