// src/app/api/admin/clear-cron-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
        privateKey: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      }),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

export async function POST(request: NextRequest) {
  try {
    const { adminId } = await request.json();
    
    if (!adminId) {
      return NextResponse.json({
        success: false,
        error: 'Admin ID is required'
      }, { status: 400 });
    }
    
    console.log(`[Admin ClearCronLogs] Clearing logs for admin: ${adminId}`);
    
    // Clear logs for this admin only
    const adminLogsSnapshot = await db.collection('logs')
      .where('adminId', '==', adminId)
      .get();
    
    const batch = db.batch();
    let deleteCount = 0;
    
    adminLogsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deleteCount++;
    });
    
    if (deleteCount > 0) {
      await batch.commit();
      console.log(`[Admin ClearCronLogs] Successfully deleted ${deleteCount} logs for admin ${adminId}`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${deleteCount} cron job logs`,
      deletedCount: deleteCount,
      adminId
    });
    
  } catch (error: any) {
    console.error('[Admin ClearCronLogs] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');
    
    if (!adminId) {
      return NextResponse.json({
        success: false,
        error: 'Admin ID is required'
      }, { status: 400 });
    }
    
    // Get log statistics for this admin
    const adminLogsSnapshot = await db.collection('logs')
      .where('adminId', '==', adminId)
      .get();
    const totalLogs = adminLogsSnapshot.size;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const oldLogsSnapshot = await db.collection('logs')
      .where('adminId', '==', adminId)
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
      .get();
    const oldLogs = oldLogsSnapshot.size;
    
    const recentLogs = totalLogs - oldLogs;
    
    return NextResponse.json({
      success: true,
      statistics: {
        totalLogs,
        recentLogs: recentLogs,
        oldLogs: oldLogs,
        cutoffDate: sevenDaysAgo.toISOString(),
        adminId
      }
    });
    
  } catch (error: any) {
    console.error('[Admin ClearCronLogs] Error getting statistics:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
