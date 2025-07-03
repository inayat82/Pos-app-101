// src/app/api/admin/takealot/check-connection/route.ts
import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import { checkTakealotConnection, TakealotApiError } from '@/modules/takealot/services';

export async function POST(request: Request) {
  let integrationId: string | undefined;
  try {
    console.log('=== API Route: check-connection started ===');
    const body = await request.json();
    console.log('Request body received:', { integrationId: body.integrationId, hasApiKey: !!body.apiKey });
    
    integrationId = body.integrationId;
    const providedApiKey = body.apiKey; // Accept API key from request

    if (!integrationId) {
      console.log('Missing integrationId');
      return NextResponse.json({ message: 'Integration ID is required' }, { status: 400 });
    }    const integrationDocRef = dbAdmin.collection('takealotIntegrations').doc(integrationId as string);
    const integrationDocSnap = await integrationDocRef.get();

    if (!integrationDocSnap.exists) {
      return NextResponse.json({ message: 'Takealot integration not found' }, { status: 404 });
    }const integrationData = integrationDocSnap.data();    const apiKey = providedApiKey || integrationData?.apiKey; // Use provided API key or fallback to stored one
    console.log('Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NONE');
    const diagnosticsDocRef = dbAdmin.collection('takealotIntegrations').doc(integrationId).collection('diagnostics').doc('apiChecks');

    if (!apiKey) {
      console.log('No API key available');
      await diagnosticsDocRef.set({
        lastConnectionCheck: {
          status: 'error',
          message: 'API key not found for this integration in Firestore.',
          testedAt: new Date(),
        }
      }, { merge: true }).catch((err: any) => console.error("Failed to set diagnostics for missing API key:", err));
      return NextResponse.json({ status: 'error', message: 'API key not found for this integration' }, { status: 400 });
    }

    console.log('Calling checkTakealotConnection...');
    const connectionResult = await checkTakealotConnection(apiKey);
    console.log('Connection result:', connectionResult);    await diagnosticsDocRef.set({
      lastConnectionCheck: {
        status: connectionResult.success ? 'success' : 'error',
        message: connectionResult.message,
        details: connectionResult.details || null,
        testedAt: new Date(),
      }
    }, { merge: true }).catch((err: any) => console.error("Failed to set diagnostics doc:", err));if (connectionResult.success) {
      console.log('Connection successful, saving to Firestore...');
      return NextResponse.json({ status: 'success', message: connectionResult.message });
    } else {
      console.log('Connection failed:', connectionResult.message);
      const statusCode = connectionResult.details?.statusCode || 400;
      return NextResponse.json({ 
        status: 'error', 
        message: connectionResult.message, 
        details: connectionResult.details 
      }, { status: statusCode });
    }

  } catch (error: any) {
    console.error(`Error in POST /check-connection (Integration ID: ${integrationId || 'unknown'}):`, error);
    console.error('Error stack:', error.stack);    if (integrationId) { // Try to save error to diagnostics if integrationId was parsed
        const diagnosticsDocRefOnError = dbAdmin.collection('takealotIntegrations').doc(integrationId).collection('diagnostics').doc('apiChecks');
        await diagnosticsDocRefOnError.set({
          lastConnectionCheck: {
            status: 'error',
            message: error instanceof TakealotApiError ? error.message : 'An unexpected server error occurred.',
            details: error instanceof TakealotApiError ? 
              { statusCode: error.statusCode, errorCode: error.errorCode, apiDetails: error.details } : 
              { message: error.message, stack: error.stack },
            testedAt: new Date(),
          }
        }, { merge: true }).catch((diagError: any) => 
            console.error(`Failed to set diagnostics on unexpected error (Integration ID: ${integrationId}):`, diagError)
        );
    }
    const message = error instanceof TakealotApiError ? error.message : 'Failed to check API connection due to an unexpected server error.';
    const status = error instanceof TakealotApiError ? error.statusCode || 500 : 500;
    return NextResponse.json({ message, error: error.message, details: error.details }, { status });
  }
}
