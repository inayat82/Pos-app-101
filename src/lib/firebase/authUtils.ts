// src/lib/firebase/authUtils.ts
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { firebaseAdmin } from './firebaseAdmin'; // Assuming firebaseAdmin is your initialized admin SDK

interface UserSession {
  id: string;
  email: string | undefined;
  role?: string;
  // Add other relevant user properties from your session
}

interface AuthResult {
  session: { user: UserSession } | null;
  error?: string;
}

export async function getUserAuth(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies(); // Await the cookie store
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) {
      return { session: null, error: 'Session cookie not found.' };
    }

    const decodedToken = await firebaseAdmin.auth().verifySessionCookie(sessionCookie, true /** checkRevoked */);
    
    // You might want to fetch additional user details from Firestore here if needed
    // For example, user roles or profile information

    return {
      session: {
        user: {
          id: decodedToken.uid,
          email: decodedToken.email,
          // map other token claims to your UserSession interface
        },
      },
    };
  } catch (error: any) {
    console.error('Error verifying session cookie:', error);
    // If the error is due to an expired or invalid cookie, it's a normal unauthenticated state.
    // Otherwise, it might be a server-side issue.
    if (error.code === 'auth/session-cookie-expired' || error.code === 'auth/argument-error') {
      return { session: null, error: 'Session expired or invalid.' };
    }
    return { session: null, error: 'Failed to authenticate user.' };
  }
}

// You can add other auth-related utility functions here, e.g.:
// - createSessionCookie

export async function verifyAuthToken(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    // Try to get the session cookie from the request
    const sessionCookie = request.cookies.get('__session')?.value;
    
    if (!sessionCookie) {
      return { success: false, error: 'Session cookie not found' };
    }

    const decodedToken = await firebaseAdmin.auth().verifySessionCookie(sessionCookie, true);
    
    // Fetch user role from Firestore
    const userDoc = await firebaseAdmin.firestore().collection('users').doc(decodedToken.uid).get();
    let userRole = 'user';
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      userRole = userData?.role || 'user';
    }
    
    return {
      success: true,
      user: {
        id: decodedToken.uid,
        email: decodedToken.email,
        role: userRole
      }
    };
  } catch (error: any) {
    console.error('Error verifying auth token:', error);
    return { success: false, error: 'Authentication failed' };
  }
}
