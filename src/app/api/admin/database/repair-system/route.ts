// src/app/api/admin/database/repair-system/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import { authAdmin } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { actions = [] } = await request.json();
    
    const repair: any = {
      timestamp: new Date().toISOString(),
      actionsRequested: actions,
      results: {}
    };

    console.log('[DatabaseRepair] Starting database repair with actions:', actions);

    // Action 1: Create missing collections with initial documents
    if (actions.includes('createMissingCollections')) {
      try {
        const collections = [
          'users',
          'admins',
          'takealotIntegrations', 
          'logs',
          'superadmin'
        ];

        for (const collectionName of collections) {
          try {
            // Check if collection exists by trying to get a document
            const snapshot = await dbAdmin.collection(collectionName).limit(1).get();
            
            if (snapshot.empty) {
              // Collection is empty, create an initial document
              const initialDoc = {
                _created: new Date().toISOString(),
                _type: 'system_generated',
                _collection: collectionName,
                _note: 'Initial document to ensure collection exists'
              };
              
              await dbAdmin.collection(collectionName).doc('_system_init').set(initialDoc);
              console.log(`[DatabaseRepair] Created initial document for collection: ${collectionName}`);
            }
          } catch (error) {
            console.error(`[DatabaseRepair] Error with collection ${collectionName}:`, error);
          }
        }

        repair.results.createMissingCollections = {
          status: 'completed',
          message: 'Ensured all core collections exist'
        };
      } catch (error: any) {
        repair.results.createMissingCollections = {
          status: 'failed',
          error: error.message
        };
      }
    }

    // Action 2: Fix user role assignments
    if (actions.includes('fixUserRoles')) {
      try {
        const usersSnapshot = await dbAdmin.collection('users').get();
        let fixedUsers = 0;

        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data();
          let needsUpdate = false;
          const updates: any = {};

          // Ensure role field exists
          if (!userData.role) {
            updates.role = 'admin'; // Default to admin
            needsUpdate = true;
          }

          // Ensure email field exists
          if (!userData.email && userDoc.id) {
            try {
              const userRecord = await authAdmin.getUser(userDoc.id);
              if (userRecord.email) {
                updates.email = userRecord.email;
                needsUpdate = true;
              }
            } catch (authError) {
              console.warn(`Could not get auth data for user ${userDoc.id}`);
            }
          }

          // Ensure name field exists
          if (!userData.name) {
            updates.name = userData.email?.split('@')[0] || userData.displayName || 'User';
            needsUpdate = true;
          }

          // Ensure timestamps exist
          if (!userData.createdAt) {
            updates.createdAt = new Date().toISOString();
            needsUpdate = true;
          }

          if (needsUpdate) {
            await dbAdmin.collection('users').doc(userDoc.id).update(updates);
            fixedUsers++;
          }
        }

        repair.results.fixUserRoles = {
          status: 'completed',
          message: `Fixed ${fixedUsers} user profiles`,
          fixedCount: fixedUsers
        };
      } catch (error: any) {
        repair.results.fixUserRoles = {
          status: 'failed',
          error: error.message
        };
      }
    }

    // Action 3: Create missing admin documents
    if (actions.includes('createMissingAdminDocs')) {
      try {
        const usersSnapshot = await dbAdmin.collection('users')
          .where('role', '==', 'admin')
          .get();

        let createdAdminDocs = 0;

        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data();
          
          // Check if admin document exists
          const adminDocRef = dbAdmin.collection('admins').doc(userDoc.id);
          const adminDoc = await adminDocRef.get();
          
          if (!adminDoc.exists) {
            const adminData = {
              adminUID: userDoc.id,
              email: userData.email,
              name: userData.name || userData.email?.split('@')[0] || 'Admin User',
              createdAt: new Date().toISOString(),
              role: 'admin',
              active: true
            };
            
            await adminDocRef.set(adminData);
            createdAdminDocs++;
            console.log(`[DatabaseRepair] Created admin document for ${userDoc.id}`);
          }
        }

        repair.results.createMissingAdminDocs = {
          status: 'completed',
          message: `Created ${createdAdminDocs} missing admin documents`,
          createdCount: createdAdminDocs
        };
      } catch (error: any) {
        repair.results.createMissingAdminDocs = {
          status: 'failed',
          error: error.message
        };
      }
    }

    // Action 4: Initialize Webshare system
    if (actions.includes('initializeWebshare')) {
      try {
        const webshareConfigRef = dbAdmin
          .collection('superadmin')
          .doc('webshare')
          .collection('config')
          .doc('main');

        const configDoc = await webshareConfigRef.get();
        
        if (!configDoc.exists) {
          const defaultConfig = {
            apiKey: '',
            isEnabled: false,
            lastSyncAt: null,
            syncInterval: 60,
            maxRetries: 3,
            timeout: 30000,
            testStatus: 'not_tested',
            lastTestError: null,
            autoSyncEnabled: false,
            autoSyncInterval: 60,
            lastAutoSyncAt: null,
            profile: null,
            subscription: null,
            cronSettings: {
              statsUpdateInterval: 60,
              lastStatsUpdate: null,
              autoRefreshProxies: true,
              proxyHealthCheckInterval: 30,
            },
            preferences: {
              timezone: 'UTC',
              notifications: {
                email: false,
                lowBalance: false,
                proxyExpiry: false,
                syncErrors: false,
              },
              dashboard: {
                defaultTab: 'account',
                refreshInterval: 30,
                showAdvancedMetrics: false,
              },
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await webshareConfigRef.set(defaultConfig);
          console.log('[DatabaseRepair] Initialized Webshare configuration');
        }

        repair.results.initializeWebshare = {
          status: 'completed',
          message: 'Webshare system initialized'
        };
      } catch (error: any) {
        repair.results.initializeWebshare = {
          status: 'failed',
          error: error.message
        };
      }
    }

    // Action 5: Clean up orphaned data
    if (actions.includes('cleanupOrphanedData')) {
      try {
        // Check for takealot integrations without valid admin references
        const integrationsSnapshot = await dbAdmin.collection('takealotIntegrations').get();
        let cleanedIntegrations = 0;

        for (const integrationDoc of integrationsSnapshot.docs) {
          const integrationData = integrationDoc.data();
          
          if (integrationData.adminId) {
            // Check if admin still exists
            const adminDoc = await dbAdmin.collection('users').doc(integrationData.adminId).get();
            
            if (!adminDoc.exists) {
              // Mark integration as orphaned rather than deleting
              await dbAdmin.collection('takealotIntegrations').doc(integrationDoc.id).update({
                orphaned: true,
                orphanedAt: new Date().toISOString(),
                originalAdminId: integrationData.adminId
              });
              cleanedIntegrations++;
            }
          }
        }

        repair.results.cleanupOrphanedData = {
          status: 'completed',
          message: `Marked ${cleanedIntegrations} orphaned integrations`,
          cleanedCount: cleanedIntegrations
        };
      } catch (error: any) {
        repair.results.cleanupOrphanedData = {
          status: 'failed',
          error: error.message
        };
      }
    }

    // Action 6: Rebuild indexes (metadata collection)
    if (actions.includes('rebuildIndexes')) {
      try {
        // Create metadata collection to track counts and indexes
        const metadataRef = dbAdmin.collection('_metadata');
        
        // Count users by role
        const usersSnapshot = await dbAdmin.collection('users').get();
        const roleStats = usersSnapshot.docs.reduce((acc: any, doc) => {
          const role = doc.data().role || 'undefined';
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        }, {});

        await metadataRef.doc('user_stats').set({
          totalUsers: usersSnapshot.size,
          roleDistribution: roleStats,
          lastUpdated: new Date().toISOString()
        });

        // Count integrations
        const integrationsSnapshot = await dbAdmin.collection('takealotIntegrations').get();
        await metadataRef.doc('integration_stats').set({
          totalIntegrations: integrationsSnapshot.size,
          activeIntegrations: integrationsSnapshot.docs.filter(doc => !doc.data().orphaned).length,
          lastUpdated: new Date().toISOString()
        });

        repair.results.rebuildIndexes = {
          status: 'completed',
          message: 'Rebuilt metadata indexes'
        };
      } catch (error: any) {
        repair.results.rebuildIndexes = {
          status: 'failed',
          error: error.message
        };
      }
    }

    // Calculate overall repair status
    const resultStatuses = Object.values(repair.results).map((result: any) => result.status);
    const failedActions = resultStatuses.filter(status => status === 'failed').length;
    const completedActions = resultStatuses.filter(status => status === 'completed').length;

    repair.overallStatus = failedActions === 0 ? 'success' : 'partial';
    repair.summary = `${completedActions}/${resultStatuses.length} repair actions completed successfully`;

    console.log(`[DatabaseRepair] Completed - ${repair.summary}`);

    return NextResponse.json({
      success: true,
      repair
    });

  } catch (error: any) {
    console.error('[DatabaseRepair] Critical error during repair:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Database repair failed',
      message: error.message
    }, { status: 500 });
  }
}
