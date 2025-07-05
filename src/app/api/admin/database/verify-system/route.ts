// src/app/api/admin/database/verify-system/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import { authAdmin } from '@/lib/firebase/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const verification: any = {
      timestamp: new Date().toISOString(),
      systemStatus: 'checking',
      checks: {}
    };

    console.log('[DatabaseVerification] Starting comprehensive database verification...');

    // 1. Firebase Admin Connection Test
    try {
      const testCollection = await dbAdmin.collection('_verification').get();
      verification.checks.firebaseAdmin = {
        status: 'passed',
        message: 'Firebase Admin SDK connected successfully',
        canQuery: true
      };
      console.log('[DatabaseVerification] ✅ Firebase Admin SDK - Connected');
    } catch (error: any) {
      verification.checks.firebaseAdmin = {
        status: 'failed',
        error: error.message,
        canQuery: false
      };
      console.error('[DatabaseVerification] ❌ Firebase Admin SDK - Failed:', error);
    }

    // 2. Authentication Service Test
    try {
      const usersList = await authAdmin.listUsers(1); // Get just 1 user as test
      verification.checks.authentication = {
        status: 'passed',
        message: 'Authentication service accessible',
        userCount: usersList.users.length
      };
      console.log('[DatabaseVerification] ✅ Authentication Service - Working');
    } catch (error: any) {
      verification.checks.authentication = {
        status: 'failed',
        error: error.message
      };
      console.error('[DatabaseVerification] ❌ Authentication Service - Failed:', error);
    }

    // 3. Core Collections Verification
    const coreCollections = [
      'users',
      'admins', 
      'takealotIntegrations',
      'superadmin'
    ];

    verification.checks.collections = {};

    for (const collectionName of coreCollections) {
      try {
        const snapshot = await dbAdmin.collection(collectionName).limit(1).get();
        verification.checks.collections[collectionName] = {
          status: 'accessible',
          exists: true,
          documentCount: snapshot.size,
          canRead: true
        };
        console.log(`[DatabaseVerification] ✅ Collection '${collectionName}' - Accessible`);
      } catch (error: any) {
        verification.checks.collections[collectionName] = {
          status: 'failed',
          exists: false,
          error: error.message,
          canRead: false
        };
        console.error(`[DatabaseVerification] ❌ Collection '${collectionName}' - Failed:`, error);
      }
    }

    // 4. User Role System Verification
    try {
      const usersSnapshot = await dbAdmin.collection('users').limit(10).get();
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        role: doc.data().role,
        email: doc.data().email
      }));

      const roleDistribution = users.reduce((acc: any, user) => {
        const role = user.role || 'undefined';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {});

      verification.checks.userRoles = {
        status: 'passed',
        totalUsers: users.length,
        roleDistribution,
        hasValidRoles: users.some(u => ['admin', 'superadmin', 'takealot_user', 'pos_user'].includes(u.role))
      };
      console.log('[DatabaseVerification] ✅ User Role System - Working');
    } catch (error: any) {
      verification.checks.userRoles = {
        status: 'failed',
        error: error.message
      };
      console.error('[DatabaseVerification] ❌ User Role System - Failed:', error);
    }

    // 5. Takealot Integration Data Verification
    try {
      const integrationsSnapshot = await dbAdmin.collection('takealotIntegrations').limit(5).get();
      const integrations = integrationsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          hasApiKey: !!data.apiKey,
          adminId: data.adminId,
          accountName: data.accountName,
          createdAt: data.createdAt
        };
      });

      verification.checks.takealotIntegrations = {
        status: 'passed',
        totalIntegrations: integrations.length,
        validIntegrations: integrations.filter(i => i.hasApiKey && i.adminId).length,
        sampleData: integrations.slice(0, 3)
      };
      console.log('[DatabaseVerification] ✅ Takealot Integrations - Working');
    } catch (error: any) {
      verification.checks.takealotIntegrations = {
        status: 'failed',
        error: error.message
      };
      console.error('[DatabaseVerification] ❌ Takealot Integrations - Failed:', error);
    }

    // 6. Webshare Proxy Data Verification
    try {
      const webshareConfigDoc = await dbAdmin
        .collection('superadmin')
        .doc('webshare')
        .collection('config')
        .doc('main')
        .get();

      const proxiesSnapshot = await dbAdmin
        .collection('superadmin')
        .doc('webshare')
        .collection('proxies')
        .limit(5)
        .get();

      verification.checks.webshareSystem = {
        status: 'passed',
        configExists: webshareConfigDoc.exists,
        isConfigured: webshareConfigDoc.exists && !!webshareConfigDoc.data()?.apiKey,
        proxyCount: proxiesSnapshot.size,
        validProxies: proxiesSnapshot.docs.filter(doc => 
          doc.data().valid && doc.data().proxy_address
        ).length
      };
      console.log('[DatabaseVerification] ✅ Webshare System - Working');
    } catch (error: any) {
      verification.checks.webshareSystem = {
        status: 'failed',
        error: error.message
      };
      console.error('[DatabaseVerification] ❌ Webshare System - Failed:', error);
    }

    // 7. Sync Logs Verification
    try {
      const cronLogsSnapshot = await dbAdmin.collection('logs').limit(5).get();
      const logs = cronLogsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          status: data.status,
          cronJobName: data.cronJobName,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        };
      });

      verification.checks.syncLogs = {
        status: 'passed',
        totalLogs: logs.length,
        recentLogs: logs.slice(0, 3),
        hasFailures: logs.some(log => log.status === 'failure')
      };
      console.log('[DatabaseVerification] ✅ Sync Logs - Working');
    } catch (error: any) {
      verification.checks.syncLogs = {
        status: 'failed',
        error: error.message
      };
      console.error('[DatabaseVerification] ❌ Sync Logs - Failed:', error);
    }

    // 8. Database Write Test
    try {
      const testDoc = {
        timestamp: new Date().toISOString(),
        testId: `verification-${Date.now()}`,
        status: 'write-test'
      };

      await dbAdmin.collection('_verification').doc('write-test').set(testDoc);
      
      // Verify write by reading back
      const writtenDoc = await dbAdmin.collection('_verification').doc('write-test').get();
      
      if (writtenDoc.exists && writtenDoc.data()?.testId === testDoc.testId) {
        verification.checks.databaseWrite = {
          status: 'passed',
          message: 'Database write and read operations working',
          canWrite: true,
          canRead: true
        };
        console.log('[DatabaseVerification] ✅ Database Write/Read - Working');
      } else {
        throw new Error('Write verification failed - data mismatch');
      }
    } catch (error: any) {
      verification.checks.databaseWrite = {
        status: 'failed',
        error: error.message,
        canWrite: false
      };
      console.error('[DatabaseVerification] ❌ Database Write/Read - Failed:', error);
    }

    // Calculate overall system status
    const checkStatuses = Object.values(verification.checks).map((check: any) => {
      if (typeof check === 'object' && check.status) {
        return check.status;
      }
      // Handle nested checks (like collections)
      if (typeof check === 'object') {
        const nestedStatuses = Object.values(check).map((nestedCheck: any) => nestedCheck.status);
        return nestedStatuses.includes('failed') ? 'failed' : 'passed';
      }
      return 'unknown';
    }).flat();

    const failedChecks = checkStatuses.filter(status => status === 'failed').length;
    const passedChecks = checkStatuses.filter(status => status === 'passed').length;
    const totalChecks = checkStatuses.length;

    if (failedChecks === 0) {
      verification.systemStatus = 'healthy';
      verification.summary = `All ${totalChecks} checks passed - Database system is fully operational`;
    } else if (failedChecks < totalChecks / 2) {
      verification.systemStatus = 'partial';
      verification.summary = `${passedChecks}/${totalChecks} checks passed - Some issues detected but system mostly functional`;
    } else {
      verification.systemStatus = 'critical';
      verification.summary = `${failedChecks}/${totalChecks} checks failed - Critical database issues detected`;
    }

    verification.healthScore = Math.round((passedChecks / totalChecks) * 100);

    console.log(`[DatabaseVerification] Completed - Status: ${verification.systemStatus} (${verification.healthScore}% healthy)`);

    return NextResponse.json({
      success: true,
      verification
    });

  } catch (error: any) {
    console.error('[DatabaseVerification] Critical error during verification:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Database verification failed',
      message: error.message,
      verification: {
        systemStatus: 'critical',
        timestamp: new Date().toISOString(),
        criticalError: error.message
      }
    }, { status: 500 });
  }
}
