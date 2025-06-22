// src/app/api/admin/takealot/check-products/route.ts
import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import { getTakealotProductTotals, TakealotApiError } from '@/lib/takealotApiService';

export async function POST(request: Request) {
  try {
    console.log('=== API Route: check-products started ===');
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

    console.log('Calling getTakealotProductTotals...');
    const productCheckResult = await getTakealotProductTotals(apiKey);
    console.log('Product check result:', productCheckResult);

    const diagnosticsDocRef = dbAdmin.collection('takealotIntegrations').doc(integrationId).collection('diagnostics').doc('apiChecks');

    if (productCheckResult.success) {
      console.log('Products check successful, saving to Firestore...');
      await diagnosticsDocRef.set({
        products: {
          totalProducts: productCheckResult.totalProducts,
          totalPages: productCheckResult.totalPages,
          checkedAt: new Date(),
        }
      }, { merge: true });
      
      return NextResponse.json({
        status: 'success',
        message: productCheckResult.message,
        totalProducts: productCheckResult.totalProducts,
        totalPages: productCheckResult.totalPages,
      });
    } else {
      console.log('Products check failed:', productCheckResult.message);
      const errorDetails = productCheckResult.details;
      await diagnosticsDocRef.set({
        products: {
          totalProducts: null,
          totalPages: null,
          checkedAt: new Date(),
          errorMessage: productCheckResult.message,
          errorDetails: errorDetails || null,
        }
      }, { merge: true });

      const statusCode = errorDetails?.statusCode || 400;
      return NextResponse.json({ 
        status: 'error', 
        message: productCheckResult.message, 
        details: errorDetails 
      }, { status: statusCode });
    }

  } catch (error: any) {
    console.error('Error checking Takealot total products:', error);
    console.error('Error stack:', error.stack);
    const errorMessage = error.message || 'An unexpected error occurred.';
    const status = error instanceof TakealotApiError ? error.statusCode : 500;
    return NextResponse.json({ message: 'Failed to check total products', error: errorMessage }, { status });
  }
}
