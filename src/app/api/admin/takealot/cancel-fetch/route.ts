// src/app/api/admin/takealot/cancel-fetch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import '@/lib/firebase/firebaseAdmin'; // Initialize Firebase Admin

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { integrationId } = await request.json();

    if (!integrationId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: integrationId' 
      }, { status: 400 });
    }

    // Verify user has access to this integration
    const db = getFirestore();
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const integration = integrationDoc.data();
    if (integration?.adminId !== decodedToken.uid && integration?.assignedUserId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Access denied to this integration' }, { status: 403 });
    }

    // Find running jobs for this integration and cancel them
    const runningJobsQuery = await db.collection('takealotJobLogs')
      .where('integrationId', '==', integrationId)
      .where('status', '==', 'running')
      .get();

    const cancelledJobs = [];
    for (const jobDoc of runningJobsQuery.docs) {
      await jobDoc.ref.update({
        status: 'cancelled',
        endTime: new Date(),
        logs: [...(jobDoc.data().logs || []), 'Operation cancelled by user']
      });
      cancelledJobs.push(jobDoc.id);
    }

    return NextResponse.json({
      success: true,
      message: `Cancelled ${cancelledJobs.length} running jobs`,
      cancelledJobs
    });

  } catch (error: any) {
    console.error('Cancel fetch error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
