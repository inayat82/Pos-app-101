// src/app/api/admin/takealot/check-sales/route.ts
import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import { getTakealotSalesTotals, TakealotApiError } from '@/lib/takealotApiService';

export async function POST(request: Request) {
  try {
    console.log('=== API Route: check-sales started ===');
    const { integrationId, apiKey: providedApiKey } = await request.json();
    console.log('Request body received:', { integrationId, hasApiKey: !!providedApiKey });

    if (!integrationId) {
      return NextResponse.json({ message: 'Integration ID is required' }, { status: 400 });
    }

    const integrationDocRef = dbAdmin.collection('takealotIntegrations').doc(integrationId as string);
    const integrationDocSnap = await integrationDocRef.get();

    if (!integrationDocSnap.exists) {
      return NextResponse.json({ message: 'Takealot integration not found' }, { status: 404 });
    }

    const integrationData = integrationDocSnap.data();
    const apiKey = providedApiKey || integrationData?.apiKey;
    console.log('Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NONE');

    if (!apiKey) {
      return NextResponse.json({ message: 'API key not found for this integration' }, { status: 400 });
    }

    console.log('Calling getTakealotSalesTotals...');
    const salesCheckResult = await getTakealotSalesTotals(apiKey);
    console.log('Sales check result:', salesCheckResult);

    const diagnosticsDocRef = dbAdmin.collection('takealotIntegrations').doc(integrationId).collection('diagnostics').doc('apiChecks');

    if (salesCheckResult.success) {
      console.log('Sales check successful, saving to Firestore...');
      await diagnosticsDocRef.set({
        sales: {
          totalSales: salesCheckResult.totalSales,
          totalPages: salesCheckResult.totalPages,
          checkedAt: new Date(),
        }
      }, { merge: true });
      
      return NextResponse.json({
        status: 'success',
        message: salesCheckResult.message,
        totalSales: salesCheckResult.totalSales,
        totalPages: salesCheckResult.totalPages,
      });
    } else {
      console.log('Sales check failed:', salesCheckResult.message);
      const errorDetails = salesCheckResult.details;
      await diagnosticsDocRef.set({
        sales: {
          totalSales: null,
          totalPages: null,
          checkedAt: new Date(),
          errorMessage: salesCheckResult.message,
          errorDetails: errorDetails || null,
        }
      }, { merge: true });

      const statusCode = errorDetails?.statusCode || 400;
      return NextResponse.json({ 
        status: 'error', 
        message: salesCheckResult.message, 
        details: errorDetails 
      }, { status: statusCode });
    }

  } catch (error: any) {
    console.error('Error checking Takealot 30 days sales:', error);
    console.error('Error stack:', error.stack);
    const errorMessage = error.message || 'An unexpected error occurred.';
    const status = error instanceof TakealotApiError ? error.statusCode : 500;
    return NextResponse.json({ message: 'Failed to check 30 days sales', error: errorMessage }, { status });
  }
}
