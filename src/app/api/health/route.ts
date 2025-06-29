import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    hasFirebaseConfig: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID),
    authMethod: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? 'full_json' : 'individual_vars'
  });
}
