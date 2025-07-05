// src/app/api/superadmin/clear-cron-logs/route.ts
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
    const { adminId, type } = await request.json();
    
    console.log(`[ClearCronLogs] Request - adminId: ${adminId}, type: ${type}`);
    
    if (type === 'all') {
      // Clear all logs
      console.log('[ClearCronLogs] Clearing ALL cron job logs...');
      const allLogsSnapshot = await db.collection('logs').get();
      
      const batch = db.batch();
      let deleteCount = 0;
      
      allLogsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });
      
      if (deleteCount > 0) {
        await batch.commit();
        console.log(`[ClearCronLogs] Successfully deleted ${deleteCount} logs`);
      }
      
      return NextResponse.json({
        success: true,
        message: `Cleared all ${deleteCount} cron job logs`,
        deletedCount: deleteCount
      });
      
    } else if (type === 'admin' && adminId) {
      // Clear logs for specific admin
      console.log(`[ClearCronLogs] Clearing logs for admin: ${adminId}`);
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
        console.log(`[ClearCronLogs] Successfully deleted ${deleteCount} logs for admin ${adminId}`);
      }
      
      return NextResponse.json({
        success: true,
        message: `Cleared ${deleteCount} cron job logs for admin ${adminId}`,
        deletedCount: deleteCount,
        adminId
      });
      
    } else if (type === 'old') {
      // Clear logs older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      console.log(`[ClearCronLogs] Clearing logs older than: ${sevenDaysAgo.toISOString()}`);
      
      const oldLogsSnapshot = await db.collection('logs')
        .where('createdAt', '<', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
        .get();
      
      const batch = db.batch();
      let deleteCount = 0;
      
      oldLogsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });
      
      if (deleteCount > 0) {
        await batch.commit();
        console.log(`[ClearCronLogs] Successfully deleted ${deleteCount} old logs`);
      }
      
      return NextResponse.json({
        success: true,
        message: `Cleared ${deleteCount} logs older than 7 days`,
        deletedCount: deleteCount,
        cutoffDate: sevenDaysAgo.toISOString()
      });
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid request. Type must be "all", "admin" (with adminId), or "old"'
      }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('[ClearCronLogs] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get log statistics
    const totalLogsSnapshot = await db.collection('logs').get();
    const totalLogs = totalLogsSnapshot.size;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const oldLogsSnapshot = await db.collection('logs')
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
        cutoffDate: sevenDaysAgo.toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('[ClearCronLogs] Error getting statistics:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
