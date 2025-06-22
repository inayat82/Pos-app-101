import { NextResponse } from 'next/server';
import { dbAdmin, authAdmin } from '@/lib/firebase/firebaseAdmin'; // Admin SDK
import { UserRole } from '@/types/user';
import { FieldValue } from 'firebase-admin/firestore'; // Use FieldValue from admin SDK

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    const token = authorization.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await authAdmin.verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const adminUserProfileDoc = await dbAdmin.collection('users').doc(decodedToken.uid).get();
    if (!adminUserProfileDoc.exists || adminUserProfileDoc.data()?.role !== UserRole.Admin) {
        return NextResponse.json({ error: 'Forbidden: User is not an Admin or profile not found.' }, { status: 403 });
    }

    const body = await request.json();
    const { accountName, apiKey, assignedUserId } = body;
    const adminId = decodedToken.uid;

    if (!accountName || !apiKey || !adminId) {
      return NextResponse.json({ error: 'Missing required fields: accountName, apiKey, adminId' }, { status: 400 });
    }

    // Use admin SDK for Firestore operations
    const newIntegrationRef = dbAdmin.collection('takealotIntegrations').doc();

    await newIntegrationRef.set({
      adminId,
      accountName,
      apiKey, 
      assignedUserId: assignedUserId || adminId, 
      createdAt: FieldValue.serverTimestamp(), // Use admin SDK's serverTimestamp
      updatedAt: FieldValue.serverTimestamp(), // Use admin SDK's serverTimestamp
      integrationId: newIntegrationRef.id,
    });

    return NextResponse.json({ message: 'Takealot integration added successfully', integrationId: newIntegrationRef.id }, { status: 201 });

  } catch (error) {
    console.error('Error adding Takealot integration:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to add Takealot integration', details: errorMessage }, { status: 500 });
  }
}
