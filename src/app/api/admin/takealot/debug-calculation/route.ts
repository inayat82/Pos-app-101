import { NextRequest, NextResponse } from 'next/server';
import { debugSingleProductCalculation } from '../../../../../lib/debugCalculationService';
import { authAdmin as auth } from '../../../../../lib/firebase/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const authToken = req.headers.get('authorization')?.split('Bearer ')[1];
    if (!authToken) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const decodedToken = await auth.verifyIdToken(authToken);
    if (!decodedToken) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await req.json();
    const { integrationId, productId } = body;

    if (!integrationId || !productId) {
      return new NextResponse(JSON.stringify({ error: 'integrationId and productId (TSIN or SKU) are required' }), { status: 400 });
    }

    const report = await debugSingleProductCalculation(integrationId, productId);

    return new NextResponse(JSON.stringify(report), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Error in debug-calculation route:', error);
    return new NextResponse(JSON.stringify({ error: 'Failed to debug calculation', details: error.message }), { status: 500 });
  }
}
