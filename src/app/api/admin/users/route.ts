import { NextRequest, NextResponse } from 'next/server';
// Client SDK imports for GET handler (if kept as is) or if db is used elsewhere for client patterns
import { collection, query, where, getDocs } from 'firebase/firestore'; 
// Remove client-side 'doc', 'setDoc', 'serverTimestamp' as POST will use admin SDK
import { db } from '@/lib/firebase/firebase'; // Client DB for operations not requiring admin (e.g., GET handler)
import { authAdmin, dbAdmin, firebaseAdmin } from '@/lib/firebase/firebaseAdmin'; // New import for admin SDK, also import firebaseAdmin namespace
import { UserRole, /*SubUser,*/ AnyUserProfile, BaseUserProfile } from '@/types/user'; // SubUser might not be needed if GET response is typed directly
import { FieldValue } from 'firebase-admin/firestore'; // Import FieldValue for admin serverTimestamp

// GET function to fetch sub-users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');
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
      console.error('Backend API: Error verifying ID token:', error);
      let errorMessage = 'Invalid or expired token (server-side)';
      if (error.code === 'auth/id-token-expired') {
        errorMessage = 'Firebase ID token has expired. Get a fresh ID token from your client app and try again. (Server details: ' + error.message + ')';
      } else if (error.code === 'auth/id-token-revoked') {
        errorMessage = 'Firebase ID token has been revoked. (Server details: ' + error.message + ')';
      } else if (error.message) {
        // Provide more specific error from Firebase Admin SDK
        errorMessage = `Token verification failed: ${error.message} (Code: ${error.code || 'UNKNOWN'})`;
      }
      console.error(`Backend API: Token verification failed at server time (UTC): ${new Date().toUTCString()}`);
      return NextResponse.json({ error: 'Invalid or expired token', details: errorMessage, code: error.code || 'UNKNOWN_AUTH_ERROR' }, { status: 401 });
    }

    if (decodedToken.uid !== adminId) {
      // TODO: Add check for SuperAdmin role
      return NextResponse.json({ error: 'Forbidden: Admin ID does not match authenticated user' }, { status: 403 });
    }
    
    if (!adminId) {
      return NextResponse.json({ error: 'adminId query parameter is required' }, { status: 400 });
    }

    // Using client 'db' for GET, assuming Firestore rules allow admin to read sub-users.
    // For full Admin SDK consistency, this could also be refactored to use dbAdmin.
    const usersCollectionRef = collection(db, 'users');
    const q = query(usersCollectionRef, where('parentAdminId', '==', adminId));
    
    const querySnapshot = await getDocs(q);
    // Define SubUser type structure here or import if available and matching
    const subUsers: { id: string; name: string; email: string | null; role: UserRole }[] = [];


    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.uid !== adminId && (data.role === UserRole.TakealotUser || data.role === UserRole.POSUser)) {
        subUsers.push({
          id: doc.id, 
          name: data.name || data.displayName || 'Unnamed User', 
          email: data.email || null,
          role: data.role as UserRole,
        });
      }
    });

    return NextResponse.json({ users: subUsers }, { status: 200 });

  } catch (error) {
    console.error('Error fetching sub-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch sub-users', details: errorMessage }, { status: 500 });
  }
}

// POST function to create a new sub-user
export async function POST(request: NextRequest) {
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
    } catch (error: unknown) { // Changed type to unknown
      console.error('Error verifying token at POST /api/admin/users:');
      console.error('Server Timestamp:', new Date().toISOString());
      // Attempt to get project ID - this might vary based on environment
      console.error('Firebase Project ID (from env):', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'Not found');
      console.error('Received Token (first 50 chars):', token.substring(0, 50));

      if (error instanceof Error) {
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        if ((error as any).code) { // Check if 'code' property exists
          console.error('Error Code:', (error as any).code);
        }
        console.error('Error Stack:', error.stack);
      } else {
        console.error('Unknown error object:', error);
      }
      return NextResponse.json({ error: 'Invalid or expired token', details: error instanceof Error ? error.message : 'Unknown verification error' }, { status: 401 });
    }

    const adminUserProfileDoc = await dbAdmin.collection('users').doc(decodedToken.uid).get();
    if (!adminUserProfileDoc.exists || adminUserProfileDoc.data()?.role !== UserRole.Admin) {
        console.warn(`Backend API: Forbidden attempt by UID ${decodedToken.uid} - not an Admin or profile not found.`);
        return NextResponse.json({ error: 'Forbidden: User is not an Admin or profile not found.' }, { status: 403 });
    }

    const { username, fullName, email, cell, role, password, parentAdminId, profilePicUrl } = await request.json();

    if (!email || !password || !role || !fullName || !parentAdminId) {
      console.warn("Backend API: Missing required fields for user creation.");
      return NextResponse.json({ error: 'Missing required fields (email, password, role, fullName, parentAdminId)' }, { status: 400 });
    }

    if (parentAdminId !== decodedToken.uid) {
      console.warn(`Backend API: Forbidden parentAdminId mismatch. Token UID: ${decodedToken.uid}, parentAdminId: ${parentAdminId}`);
      return NextResponse.json({ error: 'Forbidden: parentAdminId does not match authenticated admin user.' }, { status: 403 });
    }

    if (role !== UserRole.TakealotUser && role !== UserRole.POSUser) {
      console.warn(`Backend API: Invalid user role provided: ${role}`);
      return NextResponse.json({ error: 'Invalid user role. Must be TakealotUser or POSUser.' }, { status: 400 });
    }

    const userRecord = await authAdmin.createUser({
      email,
      password,
      displayName: fullName,
      photoURL: profilePicUrl || undefined,
      disabled: false,
    });
    console.log(`Backend API: User created in Auth. UID: ${userRecord.uid}`);

    await authAdmin.setCustomUserClaims(userRecord.uid, { role: role, adminId: parentAdminId });
    console.log(`Backend API: Custom claims set for UID: ${userRecord.uid}`);

    const userProfileData = {
      uid: userRecord.uid,
      email: userRecord.email || null,
      name: fullName,
      username: username || undefined,
      phone: cell || undefined,
      role: role as UserRole,
      parentAdminId: parentAdminId,
      createdAt: FieldValue.serverTimestamp(), 
      updatedAt: FieldValue.serverTimestamp(),
    };

    await dbAdmin.collection('users').doc(userRecord.uid).set(userProfileData);
    console.log(`Backend API: User profile saved to Firestore for UID: ${userRecord.uid}`);

    return NextResponse.json({ message: 'Sub-user created successfully', userId: userRecord.uid }, { status: 201 });

  } catch (error: any) { // Catch any other unexpected errors
    console.error('Backend API: General error in POST /api/admin/users:', error);
    let errorMessage = 'An unknown server error occurred';
    let statusCode = 500;
    let errorCode = 'GENERAL_SERVER_ERROR';

    if (error.code) { // Firebase specific errors might have a code
        errorCode = error.code;
        if (error.code === 'auth/email-already-exists') {
            errorMessage = 'Email already in use by another account.';
            statusCode = 409; // Conflict
        } else if (error.code === 'auth/invalid-password') {
            errorMessage = 'Password is invalid. It must be at least 6 characters long.';
            statusCode = 400;
        } else {
            errorMessage = error.message || errorMessage;
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    
    return NextResponse.json({ error: 'Failed to create sub-user', details: errorMessage, code: errorCode }, { status: statusCode });
  }
}
