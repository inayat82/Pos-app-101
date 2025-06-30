'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiSave, FiTrendingUp, FiPackage, FiRefreshCw,
  FiZap, FiDatabase, FiClock, FiBarChart 
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { 
  doc, getDoc, setDoc, Timestamp, collection, getDocs
} from 'firebase/firestore';

// Define the SyncStrategy interface
interface SyncStrategy {
  id: string;
  description: string;
  cronLabel: string;
  cronEnabled: boolean;
  maxPagesToFetch?: number;
}

// Default strategies matching the original settings page
const defaultSalesStrategies: SyncStrategy[] = [
  { id: 'sls_100', description: 'Last 100', cronLabel: 'Every 1 hr', cronEnabled: false, maxPagesToFetch: 1 },
  { id: 'sls_30d', description: 'Last 30 Days', cronLabel: 'Every Night', cronEnabled: false },
  { id: 'sls_6m', description: 'Last 6 Months', cronLabel: 'Every Sunday', cronEnabled: false },
  { id: 'sls_all', description: 'All Data', cronLabel: 'Manually', cronEnabled: true },
];

const defaultProductStrategies: SyncStrategy[] = [
  { id: 'prd_100_3h', description: 'Fetch 100 Products', cronLabel: 'Every 1 hr', cronEnabled: false, maxPagesToFetch: 1 },
  { id: 'prd_200_man', description: 'Fetch & Optimize 200', cronLabel: 'Every 1 hr', cronEnabled: false, maxPagesToFetch: 2 },
  { id: 'prd_all_6h', description: 'Fetch & Optimize All', cronLabel: 'Every 6 hr', cronEnabled: false },
  { id: 'prd_all_12h', description: 'Fetch & Optimize All', cronLabel: 'Every 12 hr', cronEnabled: false },
];

interface SyncStrategyPreferencesCardProps {
  integrationId: string;
  showMessage: (type: 'success' | 'error', message: string) => void;
  loadApiLogs?: () => void;
}

interface FetchOperation {
  isRunning: boolean;
  progress: number;
  message: string;
  logs: string[];
  totalFetched?: number;
  totalSaved?: number;
  totalUpdated?: number;
  newRecords?: number;
}

const SyncStrategyPreferencesCard: React.FC<SyncStrategyPreferencesCardProps> = ({
  integrationId,
  showMessage,
  loadApiLogs
}) => {
  const { currentUser } = useAuth();
  
  // State for strategies
  const [salesStrategies, setSalesStrategies] = useState<SyncStrategy[]>(defaultSalesStrategies);
  const [productStrategies, setProductStrategies] = useState<SyncStrategy[]>(defaultProductStrategies);
  const [savingSyncPrefs, setSavingSyncPrefs] = useState(false);
  
  // Fetch Operations State
  const [fetchOperations, setFetchOperations] = useState<{
    [key: string]: FetchOperation
  }>({});

  // Sync status data for strategy cards
  const [syncStatusData, setSyncStatusData] = useState<{
    [key: string]: {
      lastSync: Timestamp | null;
      totalFetched: number;
      totalSaved: number;
      totalUpdated: number;
      newRecords: number;
      totalPages: number;
      status: 'success' | 'error' | null;
    }
  }>({});

  // Helper function to format the sync timing display
  const formatSyncTimingDisplay = (strategy: SyncStrategy): string => {
    if (strategy.cronEnabled) {
      // When auto-sync is ON, show "Auto Sync Every X"
      switch (strategy.cronLabel) {
        case 'Every 1 hr':
          return 'Auto Sync Every Hour';
        case 'Every Night':
          return 'Auto Sync Every Night';
        case 'Every Sunday':
          return 'Auto Sync Every Sunday';
        case 'Every 6 hr':
          return 'Auto Sync Every 6 Hours';
        case 'Every 12 hr':
          return 'Auto Sync Every 12 Hours';
        case 'Manually':
          return 'Manual Sync Only';
        default:
          return `Auto Sync ${strategy.cronLabel}`;
      }
    } else {
      // When auto-sync is OFF, show "Auto Sync Off - [Schedule]"
      switch (strategy.cronLabel) {
        case 'Every 1 hr':
          return 'Auto Sync Off - Hourly Schedule';
        case 'Every Night':
          return 'Auto Sync Off - Nightly Schedule';
        case 'Every Sunday':
          return 'Auto Sync Off - Weekly Schedule';
        case 'Every 6 hr':
          return 'Auto Sync Off - Every 6 Hours';
        case 'Every 12 hr':
          return 'Auto Sync Off - Every 12 Hours';
        case 'Manually':
          return 'Manual Sync Only';
        default:
          return `Auto Sync Off - ${strategy.cronLabel}`;
      }
    }
  };

  // Load sync preferences
  const loadSyncPreferences = async () => {
    if (!currentUser?.uid || !integrationId) return;
    
    try {
      // Load sales strategies
      const salesRef = doc(db, `takealotIntegrations/${integrationId}/syncPreferences`, 'sales');
      const salesSnap = await getDoc(salesRef);
      if (salesSnap.exists()) {
        const salesData = salesSnap.data();
        setSalesStrategies(salesData.strategies || defaultSalesStrategies);
      }
      
      // Load product strategies
      const productsRef = doc(db, `takealotIntegrations/${integrationId}/syncPreferences`, 'products');
      const productsSnap = await getDoc(productsRef);
      if (productsSnap.exists()) {
        const productsData = productsSnap.data();
        setProductStrategies(productsData.strategies || defaultProductStrategies);
      }
    } catch (error: any) {
      console.error("Failed to load sync preferences:", error);
    }
  };

  // Load all sync status data
  const loadSyncStatusData = async () => {
    if (!currentUser?.uid || !integrationId) return;
    
    try {
      const syncStatusCollection = collection(db, `takealotIntegrations/${integrationId}/syncStatus`);
      const querySnapshot = await getDocs(syncStatusCollection);
      
      const statusData: any = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        statusData[doc.id] = {
          lastSync: data.lastSync,
          totalFetched: data.totalFetched || 0,
          totalSaved: data.totalSaved || 0,
          totalUpdated: data.totalUpdated || 0,
          newRecords: data.newRecords || 0,
          totalPages: data.totalPages || 0,
          status: data.status || null
        };
      });
      
      setSyncStatusData(statusData);
    } catch (error: any) {
      console.error("Failed to load sync status data:", error);
    }
  };

  // Save sync status data after successful fetch operation
  const saveSyncStatus = async (strategyId: string, data: {
    totalFetched: number;
    totalSaved: number;
    totalUpdated?: number;
    newRecords?: number;
    totalPages: number;
    status: 'success' | 'error';
  }) => {
    if (!currentUser?.uid || !integrationId) return;
    
    try {
      const syncStatusRef = doc(db, `takealotIntegrations/${integrationId}/syncStatus`, strategyId);
      await setDoc(syncStatusRef, {
        lastSync: Timestamp.now(),
        totalFetched: data.totalFetched,
        totalSaved: data.totalSaved,
        totalUpdated: data.totalUpdated || 0,
        newRecords: data.newRecords || 0,
        totalPages: data.totalPages,
        status: data.status,
        updatedAt: Timestamp.now()
      });
      
      // Update local state
      setSyncStatusData(prev => ({
        ...prev,
        [strategyId]: {
          lastSync: Timestamp.now(),
          totalFetched: data.totalFetched,
          totalSaved: data.totalSaved,
          totalUpdated: data.totalUpdated || 0,
          newRecords: data.newRecords || 0,
          totalPages: data.totalPages,
          status: data.status
        }
      }));
    } catch (error: any) {
      console.error("Failed to save sync status:", error);
    }
  };

  // Helper function to get sync status display data
  const getSyncStatusDisplay = (strategyId: string) => {
    const status = syncStatusData[strategyId];
    
    if (!status || !status.lastSync) {
      return {
        lastSyncText: 'Never synced',
        lastSyncColor: 'text-gray-600',
        totalFetched: 0,
        totalSaved: 0,
        totalUpdated: 0,
        newRecords: 0,
        totalPages: 0
      };
    }

    const lastSyncDate = new Date(status.lastSync.seconds * 1000);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSyncDate.getTime()) / (1000 * 60));
    
    let lastSyncText = '';
    let lastSyncColor = 'text-green-600';
    
    if (diffMinutes < 1) {
      lastSyncText = 'Just now';
    } else if (diffMinutes < 60) {
      lastSyncText = `${diffMinutes} min ago`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      lastSyncText = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      lastSyncText = `${days} day${days > 1 ? 's' : ''} ago`;
    }

    if (status.status === 'error') {
      lastSyncColor = 'text-red-600';
    }

    return {
      lastSyncText,
      lastSyncColor,
      totalFetched: status.totalFetched,
      totalSaved: status.totalSaved,
      totalUpdated: status.totalUpdated,
      newRecords: status.newRecords,
      totalPages: status.totalPages
    };
  };

  // Handle strategy toggle with automatic saving
  const handleStrategyToggle = async (type: 'sales' | 'products', strategyId: string) => {
    let updatedStrategies;
    
    if (type === 'sales') {
      updatedStrategies = salesStrategies.map(strategy => 
        strategy.id === strategyId 
          ? { ...strategy, cronEnabled: !strategy.cronEnabled }
          : strategy
      );
      setSalesStrategies(updatedStrategies);
    } else {
      updatedStrategies = productStrategies.map(strategy => 
        strategy.id === strategyId 
          ? { ...strategy, cronEnabled: !strategy.cronEnabled }
          : strategy
      );
      setProductStrategies(updatedStrategies);
    }

    // Auto-save the preferences immediately
    if (!currentUser?.uid || !integrationId) return;
    
    try {
      if (type === 'sales') {
        const salesRef = doc(db, `takealotIntegrations/${integrationId}/syncPreferences`, 'sales');
        await setDoc(salesRef, {
          strategies: updatedStrategies,
          updatedAt: Timestamp.now(),
          updatedBy: currentUser.uid
        });
      } else {
        const productsRef = doc(db, `takealotIntegrations/${integrationId}/syncPreferences`, 'products');
        await setDoc(productsRef, {
          strategies: updatedStrategies,
          updatedAt: Timestamp.now(),
          updatedBy: currentUser.uid
        });
      }
      
      showMessage('success', 'Auto-sync preference saved!');
    } catch (error: any) {
      console.error("Failed to save sync preference:", error);
      showMessage('error', `Failed to save preference: ${error.message}`);
    }
  };

  // Save sync preferences
  const handleSaveSyncPreferences = async () => {
    if (!currentUser?.uid || !integrationId) {
      showMessage('error', 'User session or Integration ID is missing.');
      return;
    }

    setSavingSyncPrefs(true);
    try {
      // Save sales strategies
      const salesRef = doc(db, `takealotIntegrations/${integrationId}/syncPreferences`, 'sales');
      await setDoc(salesRef, {
        strategies: salesStrategies,
        updatedAt: Timestamp.now(),
        updatedBy: currentUser.uid
      });

      // Save product strategies
      const productsRef = doc(db, `takealotIntegrations/${integrationId}/syncPreferences`, 'products');
      await setDoc(productsRef, {
        strategies: productStrategies,
        updatedAt: Timestamp.now(),
        updatedBy: currentUser.uid
      });

      showMessage('success', 'Sync preferences saved successfully!');
    } catch (error: any) {
      console.error("Failed to save sync preferences:", error);
      showMessage('error', `Failed to save sync preferences: ${error.message}`);
    } finally {
      setSavingSyncPrefs(false);
    }
  };

  // Handle fetch operation with new sync services for both sales and products
  const handleFetchOperation = async (strategyId: string, strategyDescription: string, type: 'sales' | 'products') => {
    if (!integrationId) {
      showMessage('error', 'Integration ID is missing.');
      return;
    }

    // Initialize operation state
    const operationKey = `${type}_${strategyId}`;
    setFetchOperations(prev => ({
      ...prev,
      [operationKey]: {
        isRunning: true,
        progress: 10,
        message: 'Starting sync operation...',
        logs: [`Starting ${strategyDescription} sync...`],
        totalFetched: 0,
        totalSaved: 0,
        totalUpdated: 0,
        newRecords: 0
      }
    }));

    try {
      if (type === 'sales') {
        // Use new sales sync service
        await handleSalesSync(strategyId, strategyDescription, operationKey);
      } else {
        // Use new product sync service with TSIN-based upsert
        await handleProductSync(strategyId, strategyDescription, operationKey);
      }
    } catch (error: any) {
      console.error('Sync operation error:', error);
      showMessage('error', `Sync operation failed: ${error.message}`);
      
      setFetchOperations(prev => ({
        ...prev,
        [operationKey]: {
          isRunning: false,
          progress: 0,
          message: `Error: ${error.message}`,
          logs: [...(prev[operationKey]?.logs || []), `Error: ${error.message}`],
          totalFetched: 0,
          totalSaved: 0,
          totalUpdated: 0,
          newRecords: 0
        }
      }));
    }
  };

  // New sales sync handler using the salesSyncService
  const handleSalesSync = async (strategyId: string, strategyDescription: string, operationKey: string) => {
    try {
      // Update progress
      setFetchOperations(prev => ({
        ...prev,
        [operationKey]: {
          ...prev[operationKey],
          progress: 20,
          message: 'Fetching sales data from API...',
          logs: [...(prev[operationKey]?.logs || []), 'Connected to Takealot API']
        }
      }));

      // Call the API endpoint to handle sales sync (which uses the new SalesSyncService)
      const response = await fetch('/api/admin/takealot/manual-sales-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          strategy: strategyDescription,
          adminId: currentUser?.uid
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Sales sync failed');
      }

      // Update progress
      setFetchOperations(prev => ({
        ...prev,
        [operationKey]: {
          ...prev[operationKey],
          progress: 50,
          message: 'Processing sales records...',
          logs: [...(prev[operationKey]?.logs || []), 'Processing sales data with order_id matching']
        }
      }));

      // Update final progress
      setFetchOperations(prev => ({
        ...prev,
        [operationKey]: {
          ...prev[operationKey],
          isRunning: false,
          progress: 100,
          message: 'Sales sync completed successfully!',
          logs: [...(prev[operationKey]?.logs || []), `Completed: ${result.totalNew} new, ${result.totalUpdated} updated`],
          totalFetched: result.totalProcessed,
          totalSaved: result.totalNew,
          totalUpdated: result.totalUpdated,
          newRecords: result.totalNew
        }
      }));

      // Show success message
      const message = `${strategyDescription} completed! ${result.totalNew} new, ${result.totalUpdated} updated, ${result.totalSkipped} unchanged`;
      showMessage('success', message);
      
      // Save sync status  
      saveSyncStatus(strategyId, {
        totalFetched: result.totalProcessed,
        totalSaved: result.totalNew,
        totalUpdated: result.totalUpdated,
        newRecords: result.totalNew,
        totalPages: Math.ceil(result.totalProcessed / 100),
        status: 'success'
      });
      
      // Reload data
      setTimeout(() => {
        if (loadApiLogs) loadApiLogs();
        loadSyncStatusData();
      }, 1000);

    } catch (error: any) {
      console.error('Sales sync error:', error);
      throw error;
    }
  };

  // Product sync using ProductSyncService
  const handleProductSync = async (strategyId: string, strategyDescription: string, operationKey: string) => {
    try {
      setFetchOperations(prev => ({
        ...prev,
        [operationKey]: {
          isRunning: true,
          progress: 0,
          message: 'Starting product sync...',
          logs: [`Starting ${strategyDescription} sync...`],
          totalFetched: 0,
          totalSaved: 0,
          totalUpdated: 0,
          newRecords: 0
        }
      }));

      // Map strategy IDs to strategy names
      let strategy = '';
      switch (strategyId) {
        case 'prd_100_3h':
          strategy = 'Fetch 100 Products';
          break;
        case 'prd_200_man':
          strategy = 'Fetch 200 Products';
          break;
        case 'prd_all_6h':
          strategy = 'Fetch All Products (6h)';
          break;
        case 'prd_all_12h':
          strategy = 'Fetch All Products (12h)';
          break;
        default:
          throw new Error(`Unknown product strategy: ${strategyId}`);
      }

      setFetchOperations(prev => ({
        ...prev,
        [operationKey]: {
          ...prev[operationKey],
          progress: 20,
          message: 'Connecting to API...',
          logs: [...(prev[operationKey]?.logs || []), 'Using ProductSyncService for TSIN-based upsert']
        }
      }));

      // Call the new product sync API
      const response = await fetch('/api/admin/takealot/manual-product-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          strategy
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Product sync failed');
      }

      // Update UI with results
      const syncResult = result.result;
      setFetchOperations(prev => ({
        ...prev,
        [operationKey]: {
          isRunning: false,
          progress: 100,
          message: `Completed: ${syncResult.totalNew} new, ${syncResult.totalUpdated} updated`,
          logs: [...(prev[operationKey]?.logs || []), `Completed: ${syncResult.totalProcessed} processed, ${syncResult.totalNew} new, ${syncResult.totalUpdated} updated, ${syncResult.totalSkipped} unchanged, ${syncResult.totalErrors} errors`],
          totalFetched: syncResult.totalProcessed,
          totalSaved: syncResult.totalNew,
          totalUpdated: syncResult.totalUpdated,
          newRecords: syncResult.totalNew
        }
      }));

      const message = `${strategyDescription} completed! ${syncResult.totalNew} new, ${syncResult.totalUpdated} updated, ${syncResult.totalSkipped} unchanged (TSIN-based upsert)`;
      showMessage('success', message);
      
      // Save sync status
      saveSyncStatus(strategyId, {
        totalFetched: syncResult.totalProcessed,
        totalSaved: syncResult.totalNew,
        totalUpdated: syncResult.totalUpdated,
        newRecords: syncResult.totalNew,
        totalPages: Math.ceil(syncResult.totalProcessed / 100) || 1,
        status: 'success'
      });
      
      // Reload data
      setTimeout(() => {
        if (loadApiLogs) loadApiLogs();
        loadSyncStatusData();
      }, 1000);

    } catch (error: any) {
      console.error('Product sync error:', error);
      
      setFetchOperations(prev => ({
        ...prev,
        [operationKey]: {
          isRunning: false,
          progress: 0,
          message: `Error: ${error.message}`,
          logs: [...(prev[operationKey]?.logs || []), `Error: ${error.message}`],
          totalFetched: 0,
          totalSaved: 0,
          totalUpdated: 0,
          newRecords: 0
        }
      }));

      showMessage('error', `Product sync failed: ${error.message}`);
      
      saveSyncStatus(strategyId, {
        totalFetched: 0,
        totalSaved: 0,
        totalUpdated: 0,
        newRecords: 0,
        totalPages: 0,
        status: 'error'
      });
      
      throw error;
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (currentUser?.uid && integrationId) {
      loadSyncPreferences();
      loadSyncStatusData();
    }
  }, [currentUser?.uid, integrationId]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
      <div className="mb-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sync Strategy Preferences</h2>
          <p className="text-sm text-gray-600">Configure automatic and manual data synchronization strategies. Auto-sync preferences save automatically when toggled.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Data Strategies */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
            Sales Data Strategies
          </h3>
          
          <div className="space-y-4">
            {salesStrategies.map(strategy => {
              const operationKey = `sales_${strategy.id}`;
              const operation = fetchOperations[operationKey];
              const statusDisplay = getSyncStatusDisplay(strategy.id);
              const isRunning = operation?.isRunning || false;
              
              return (
                <div
                  key={strategy.id}
                  className="optimized-card bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 mb-4 border border-blue-200 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{strategy.description}</p>
                      <p className={`text-xs font-medium ${
                        strategy.cronEnabled 
                          ? 'text-green-600' 
                          : strategy.cronLabel === 'Manually' 
                            ? 'text-gray-600' 
                            : 'text-orange-600'
                      }`}>
                        {formatSyncTimingDisplay(strategy)}
                      </p>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={strategy.cronEnabled || false}
                          onChange={() => handleStrategyToggle('sales', strategy.id)} 
                        />
                        <div className={`block w-11 h-6 rounded-full shadow-inner transition-colors ${strategy.cronEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${strategy.cronEnabled ? 'translate-x-full' : ''}`}></div>
                      </div>
                    </label>
                  </div>

                  <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                    <div className="text-gray-700 font-medium text-xs mb-2">
                      Last Sync: <span className={isRunning ? 'text-blue-600' : statusDisplay.lastSyncColor}>
                        {isRunning ? 'Running...' : statusDisplay.lastSyncText}
                      </span>
                    </div>

                    {!isRunning ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-gray-600">Fetched: <span className="font-semibold text-blue-600">
                            {operation?.totalFetched ?? statusDisplay.totalFetched}
                          </span></div>
                          <div className="text-gray-600">New: <span className="font-semibold text-green-600">
                            {operation?.newRecords ?? statusDisplay.newRecords}
                          </span></div>
                        </div>
                        <div>
                          <div className="text-gray-600">Updated: <span className="font-semibold text-orange-600">
                            {operation?.totalUpdated ?? statusDisplay.totalUpdated}
                          </span></div>
                          <div className="text-gray-600">Pages: <span className="font-semibold">{statusDisplay.totalPages}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-blue-600 italic">
                        Processing sales data... Please wait for results.
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => handleFetchOperation(strategy.id, strategy.description, 'sales')}
                    disabled={isRunning}
                    className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                      isRunning
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                    }`}
                  >
                    {isRunning ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>{operation?.message || 'Fetching...'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <FiTrendingUp className="w-4 h-4" />
                        <span>Sync Sales Data</span>
                      </div>
                    )}
                  </button>

                  {isRunning && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Progress</span>
                        <span>{operation?.progress || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${operation?.progress || 0}%` }}
                        ></div>
                      </div>

                      {operation?.logs?.length > 0 && (
                        <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                          {operation.logs[operation.logs.length - 1]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Product Data Strategies */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
            <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
            Product Data Strategies
          </h3>
          
          <div className="space-y-4">
            {productStrategies.map(strategy => {
              const operationKey = `products_${strategy.id}`;
              const operation = fetchOperations[operationKey];
              const statusDisplay = getSyncStatusDisplay(strategy.id);
              const isRunning = operation?.isRunning || false;
              
              return (
                <div
                  key={strategy.id}
                  className="optimized-card bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 mb-4 border border-purple-200 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-sm text-gray-800">{strategy.description}</p>
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                          TSIN Upsert
                        </span>
                      </div>
                      <p className={`text-xs font-medium ${
                        strategy.cronEnabled 
                          ? 'text-green-600' 
                          : strategy.cronLabel === 'Manually' 
                            ? 'text-gray-600' 
                            : 'text-orange-600'
                      }`}>
                        {formatSyncTimingDisplay(strategy)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Preserves calculation fields, updates only API data
                      </p>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={strategy.cronEnabled || false}
                          onChange={() => handleStrategyToggle('products', strategy.id)} 
                        />
                        <div className={`block w-11 h-6 rounded-full shadow-inner transition-colors ${strategy.cronEnabled ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${strategy.cronEnabled ? 'translate-x-full' : ''}`}></div>
                      </div>
                    </label>
                  </div>

                  <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                    <div className="text-gray-700 font-medium text-xs mb-2">
                      Last Sync: <span className={isRunning ? 'text-blue-600' : statusDisplay.lastSyncColor}>
                        {isRunning ? 'Running...' : statusDisplay.lastSyncText}
                      </span>
                    </div>

                    {!isRunning ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-gray-600">Fetched: <span className="font-semibold text-purple-600">
                            {operation?.totalFetched ?? statusDisplay.totalFetched}
                          </span></div>
                          <div className="text-gray-600">New: <span className="font-semibold text-green-600">
                            {operation?.newRecords ?? statusDisplay.newRecords}
                          </span></div>
                        </div>
                        <div>
                          <div className="text-gray-600">Updated: <span className="font-semibold text-orange-600">
                            {operation?.totalUpdated ?? statusDisplay.totalUpdated}
                          </span></div>
                          <div className="text-gray-600">Pages: <span className="font-semibold">{statusDisplay.totalPages}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-blue-600 italic">
                        Processing products... Please wait for results.
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => handleFetchOperation(strategy.id, strategy.description, 'products')}
                    disabled={isRunning}
                    className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                      isRunning
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                    }`}
                  >
                    {isRunning ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>{operation?.message || 'Fetching...'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <FiPackage className="w-4 h-4" />
                        <span>Sync Products</span>
                      </div>
                    )}
                  </button>

                  {isRunning && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Progress</span>
                        <span>{operation?.progress || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${operation?.progress || 0}%` }}
                        ></div>
                      </div>

                      {operation?.logs?.length > 0 && (
                        <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                          {operation.logs[operation.logs.length - 1]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncStrategyPreferencesCard;
