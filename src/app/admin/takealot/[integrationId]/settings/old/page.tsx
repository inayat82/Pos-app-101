// src/app/admin/takealot/[integrationId]/settings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiSave, FiTrash2, FiSettings,
  FiZap, FiPackage, FiTrendingUp, FiRefreshCw // Added new icons
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/firebase';
import { 
  doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, 
  addDoc, serverTimestamp, Timestamp, setDoc
} from 'firebase/firestore';
import { UserRole } from '@/types/user';
import { useTakealotIntegration } from '@/hooks/useTakealotIntegration';
import DataCleanupCard from '../components/DataCleanupCard';

interface TakealotIntegration {
  id: string;
  accountName: string;
  apiKey: string;
  assignedUserId: string;
  assignedUserName?: string;
  adminId: string;
  createdAt: any;
  updatedAt: any;
}

interface SubUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface CronJobSettings {
  id: string;
  integrationId: string;
  jobType: 'sales_100' | 'sales_30_days' | 'sales_6_months' | 'products_all';
  enabled: boolean;
  schedule: string; // cron expression
  lastRun?: Date;
  nextRun?: Date;
  description: string;
}

// Define the SyncStrategy interface
interface SyncStrategy {
  id: string;
  description: string;
  cronLabel: string;
  cronEnabled: boolean;
  maxPagesToFetch?: number;
}

// Default strategies
const defaultSalesStrategies: SyncStrategy[] = [
  { id: 'sls_100', description: 'Last 100', cronLabel: 'Every 1 hr', cronEnabled: false, maxPagesToFetch: 1 },
  { id: 'sls_30d', description: 'Last 30 Days', cronLabel: 'Every Night', cronEnabled: false },
  { id: 'sls_6m', description: 'Last 6 Months', cronLabel: 'Every Sunday', cronEnabled: false },
  { id: 'sls_all', description: 'All Data', cronLabel: 'Manually', cronEnabled: true },
];

const defaultProductStrategies: SyncStrategy[] = [
  { id: 'prd_100_3h', description: 'Fetch 100 Products', cronLabel: 'Manually', cronEnabled: false, maxPagesToFetch: 1 },  { id: 'prd_200_man', description: 'Fetch & Optimize 200', cronLabel: 'Manually', cronEnabled: false, maxPagesToFetch: 2 },
  { id: 'prd_all_6h', description: 'Fetch & Optimize All', cronLabel: 'Every 6 hr', cronEnabled: false },
  { id: 'prd_all_12h', description: 'Fetch & Optimize All', cronLabel: 'Every 12 hr', cronEnabled: false },
];

const TakealotSettingsPage = ({ params }: { params: Promise<{ integrationId: string }> }) => {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  const router = useRouter();
  
  // Get integrationId from params
  const [integrationId, setIntegrationId] = useState<string>('');
  
  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setIntegrationId(resolvedParams.integrationId);
    };
    resolveParams();
  }, [params]);
  
  // Use the integration hook
  const { integration: hookIntegration, isLoading: isLoadingIntegration } = useTakealotIntegration(integrationId);
  
  const [integration, setIntegration] = useState<TakealotIntegration | null>(null);
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Set page title with account name
  useEffect(() => {
    if (hookIntegration?.accountName) {
      setPageTitle(`Takealot: ${hookIntegration.accountName} - Settings`);
    } else {
      setPageTitle('Takealot Settings');
    }
    return () => setPageTitle('');
  }, [setPageTitle, hookIntegration?.accountName]);

  // Form state
  const [accountName, setAccountName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  
  // const [cronJobs, setCronJobs] = useState<CronJobSettings[]>([]); // Removed cronJobs state
  // const [isUpdatingCron, setIsUpdatingCron] = useState<string | null>(null); // Removed isUpdatingCron state
  const [salesStrategies, setSalesStrategies] = useState<SyncStrategy[]>(defaultSalesStrategies);
  const [productStrategies, setProductStrategies] = useState<SyncStrategy[]>(defaultProductStrategies);
  const [savingSyncPrefs, setSavingSyncPrefs] = useState(false);
    // API & Data Checks State
  const [isCheckingApiConnection, setIsCheckingApiConnection] = useState(false);
  const [apiConnectionResult, setApiConnectionResult] = useState<{ status: 'success' | 'error' | 'info' | null; message: string }>({ status: null, message: '' });

  const [isCheckingProducts, setIsCheckingProducts] = useState(false);
  // Corrected state for product check results to match usage
  const [productCheckResult, setProductCheckResult] = useState<{ status: 'success' | 'error' | 'info' | null; message: string; totalProducts?: number; totalPages?: number; }>({ status: null, message: '' });
  
  const [isCheckingSales, setIsCheckingSales] = useState(false);
  // Corrected state for sales check results to match usage
  const [salesCheckResult, setSalesCheckResult] = useState<{ status: 'success' | 'error' | 'info' | null; message: string; totalSales?: number; totalPages?: number; }>({ status: null, message: '' });  // Fetch Operations State
  const [fetchOperations, setFetchOperations] = useState<{
    [key: string]: {
      isRunning: boolean;
      progress: number;
      message: string;
      logs: string[];
      totalFetched?: number;
      totalSaved?: number;
      totalUpdated?: number;
      newRecords?: number;
    }
  }>({});

  // Cleanup Operations State for duplicate removal
  const [cleanupOperations, setCleanupOperations] = useState<{
    [key: string]: {
      isRunning: boolean;
      progress: number;
      message: string;
      logs: string[];
      duplicatesRemoved?: number;
      batchesProcessed?: number;
      totalRemaining?: number;
      lastResult?: {
        timestamp: string;
        duplicatesRemoved: number;
        totalRemaining: number;
        batchesProcessed: number;
      };
    }
  }>({});// API Logs State
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logsPerPage, setLogsPerPage] = useState(10); // Default 10 logs per page

  // State to hold the last checked times from Firestore
  const [lastCheckedTimes, setLastCheckedTimes] = useState<{
    connection?: Timestamp | null;
    products?: Timestamp | null;
    sales?: Timestamp | null;
  }>({});

  const [savedApiCheckData, setSavedApiCheckData] = useState<{
    products?: { totalProducts: number; totalPages: number; checkedAt: Timestamp; rawData?: any };
    sales?: { totalSales: number; totalPages: number; checkedAt: Timestamp; rawData?: any };
    lastConnectionCheck?: { status: 'success' | 'error'; message: string; testedAt: Timestamp }; // Renamed from lastTest
  } | null>(null);
    const [generalUIMessage, setGeneralUIMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });
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
  // const cronJobConfigs: Omit<CronJobSettings, 'id' | 'integrationId' | 'enabled' | 'lastRun' | 'nextRun'>[] = [ // Removed cronJobConfigs
  //   {
  //     jobType: 'sales_100',
  //     schedule: '0 * * * *', // Every hour
  //     description: '100 Sales - Every Hour'
  //   },
  //   {
  //     jobType: 'sales_30_days',
  //     schedule: '0 2 * * *', // Every night at 2 AM
  //     description: '30 Days Sales - Every Night'
  //   },
  //   {
  //     jobType: 'sales_6_months',
  //     schedule: '0 3 * * 0', // Every Sunday at 3 AM
  //     description: '6 Months Sales - Weekly'
  //   },
  //   {
  //     jobType: 'products_all',
  //     schedule: '0 */12 * * *', // Every 12 hours
  //     description: 'All Products - Every 12 Hours'
  //   }
  // ];  

  // const fetchCronJobs = async () => { // Removed fetchCronJobs function
  //   if (!currentUser?.uid || !integrationId) return;

  //   try {
  //     const cronJobsRef = collection(db, 'takealotCronJobs');
  //     const q = query(cronJobsRef, where('integrationId', '==', integrationId));
  //     const querySnapshot = await getDocs(q);
      
  //     const jobs: CronJobSettings[] = [];
  //     querySnapshot.forEach((doc) => {
  //       jobs.push({
  //         id: doc.id,
  //         ...doc.data()
  //       } as CronJobSettings);
  //     });
      
  //     setCronJobs(jobs);
  //   } catch (err: any) {
  //     console.error('Error fetching cron jobs:', err);
  //   }
  // };

  // const toggleCronJob = async (jobType: CronJobSettings['jobType']) => { // Removed toggleCronJob function
  //   if (!currentUser?.uid || !integrationId) return;

  //   setIsUpdatingCron(jobType);

  //   try {
  //     const existingJob = cronJobs.find(job => job.jobType === jobType);
  //     const jobConfig = cronJobConfigs.find(config => config.jobType === jobType);

  //     if (!jobConfig) {
  //       throw new Error('Job configuration not found');
  //     }

  //     if (existingJob) {
  //       // Update existing job
  //       const jobRef = doc(db, 'takealotCronJobs', existingJob.id);
  //       await updateDoc(jobRef, {
  //         enabled: !existingJob.enabled,
  //         updatedAt: serverTimestamp()
  //       });

  //       setCronJobs(prev => 
  //         prev.map(job => 
  //           job.id === existingJob.id 
  //             ? { ...job, enabled: !existingJob.enabled }
  //             : job
  //         )
  //       );
  //     } else {
  //       // Create new job
  //       const newJob: Omit<CronJobSettings, 'id'> = {
  //         integrationId,
  //         jobType,
  //         enabled: true,
  //         schedule: jobConfig.schedule,
  //         description: jobConfig.description
  //       };

  //       const docRef = await addDoc(collection(db, 'takealotCronJobs'), {
  //         ...newJob,
  //         createdAt: serverTimestamp(),
  //         updatedAt: serverTimestamp()
  //       });

  //       setCronJobs(prev => [...prev, {
  //         id: docRef.id,
  //         ...newJob
  //       }]);
  //     }

  //     setSuccess('Cron job updated successfully');
  //   } catch (err: any) {
  //     console.error('Error updating cron job:', err);
  //     setError(`Failed to update cron job: ${err.message}`);
  //   } finally {
  //     setIsUpdatingCron(null);
  //   }
  // };
  // Set page title
  useEffect(() => {
    setPageTitle('Integration Settings');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const showGeneralMessage = (type: 'success' | 'error', text: string) => {
    setGeneralUIMessage({ type, text });
    setTimeout(() => setGeneralUIMessage({ type: null, text: '' }), 5000);
  };  

  const handleStrategyToggle = (dataType: 'sales' | 'products', strategyId: string) => {
    if (dataType === 'sales') {
      setSalesStrategies(prev =>
        prev.map(strategy =>
          strategy.id === strategyId
            ? { ...strategy, cronEnabled: !strategy.cronEnabled }
            : strategy
        )
      );
    } else {
      setProductStrategies(prev =>
        prev.map(strategy =>
          strategy.id === strategyId
            ? { ...strategy, cronEnabled: !strategy.cronEnabled }
            : strategy
        )
      );
    }
  };

  const handleSaveSyncPreferences = async () => {
    if (!currentUser) {
      showGeneralMessage('error', 'You must be logged in to save preferences.');
      return;
    }

    setSavingSyncPrefs(true);
    try {
      // Ensure integrationId is available for the document path
      if (!integrationId) {
        showGeneralMessage('error', 'Integration ID is missing. Cannot save preferences.');
        setSavingSyncPrefs(false);
        return;
      }
      const syncPrefsRef = doc(db, `admins/${currentUser.uid}/takealotIntegrations/${integrationId}/syncPreferences`, 'preferences');
      await setDoc(syncPrefsRef, {
        salesStrategies,
        productStrategies,
        updatedAt: Timestamp.now(),
      });
      showGeneralMessage('success', 'Sync preferences saved successfully!');
    } catch (error: any) {
      showGeneralMessage('error', `Failed to save sync preferences: ${error.message}`);
    } finally { // Ensure savingSyncPrefs is reset in all cases
      setSavingSyncPrefs(false);
    }
  };
  
  const loadSyncPreferences = async () => {
    if (!currentUser?.uid || !integrationId) return;
    
    try {
      const syncPrefsRef = doc(db, `admins/${currentUser.uid}/takealotIntegrations/${integrationId}/syncPreferences`, 'preferences');
      const syncPrefsSnap = await getDoc(syncPrefsRef);
      if (syncPrefsSnap.exists()) {
        const prefs = syncPrefsSnap.data();
        const loadedSalesStrategies = (prefs.salesStrategies || defaultSalesStrategies).map((s: SyncStrategy) => ({ ...s, maxPagesToFetch: s.maxPagesToFetch }));
        const loadedProductStrategies = (prefs.productStrategies || defaultProductStrategies).map((s: SyncStrategy) => ({ ...s, maxPagesToFetch: s.maxPagesToFetch }));
        setSalesStrategies(loadedSalesStrategies);
        setProductStrategies(loadedProductStrategies);
      } else {
        setSalesStrategies(defaultSalesStrategies);
        setProductStrategies(defaultProductStrategies);
      }
      
    } catch (err: any) {
      console.error("Failed to load sync preferences:", err);
      showGeneralMessage('error', `Failed to load settings: ${err.message}`);
    }
  };  const loadSavedApiCheckData = async () => {
    if (!currentUser?.uid || !integrationId) return;
    try {
      const apiCheckDataRef = doc(db, `takealotIntegrations/${integrationId}/diagnostics`, 'apiChecks');
      const docSnap = await getDoc(apiCheckDataRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setSavedApiCheckData(data);
        // Update lastCheckedTimes from the loaded data
        setLastCheckedTimes({
          connection: data.lastConnectionCheck?.testedAt || null,
          products: data.products?.checkedAt || null,
          sales: data.sales?.checkedAt || null,
        });
        
        // Always show success messages if data exists
        if (data.products) {
          setProductCheckResult({
            status: 'success',
            message: 'Successfully fetched product totals.',
            totalProducts: data.products.totalProducts,
            totalPages: data.products.totalPages
          });
        }
        
        if (data.sales) {
          setSalesCheckResult({
            status: 'success',
            message: 'Successfully fetched sales totals.',
            totalSales: data.sales.totalSales,
            totalPages: data.sales.totalPages
          });
        }
        
        if (data.lastConnectionCheck) {
          setApiConnectionResult({
            status: data.lastConnectionCheck.status,
            message: data.lastConnectionCheck.message
          });
        }
      } else {
        setSavedApiCheckData(null);
        setLastCheckedTimes({}); // Reset if no data
      }
    } catch (error: any) {
      console.error("Failed to load saved API check data:", error);
    }
  };  // Load API logs function
  const loadApiLogs = useCallback(async (page: number = 1) => {
    if (!integrationId) return;

    setIsLoadingLogs(true);
    try {
      console.log(`Loading API logs for integration: ${integrationId}, page: ${page}`);
      const response = await fetch(`/api/admin/takealot/fetch-logs?integrationId=${integrationId}&limit=${logsPerPage}&page=${page}`);
      
      console.log('Fetch logs response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetch logs response data:', data);
        setApiLogs(data.logs || []);
        setTotalLogs(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.currentPage || page);
        console.log(`Loaded ${data.logs?.length || 0} API logs (page ${data.currentPage || page} of ${data.totalPages || 1})`);
      } else {
        const errorText = await response.text();
        console.error('Failed to load API logs:', response.status, errorText);
        showGeneralMessage('error', `Failed to load API logs: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Error loading API logs:', error);
      showGeneralMessage('error', `Error loading API logs: ${error}`);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [integrationId, logsPerPage]); // Added logsPerPage dependency// Fetch integration and sub-users
  useEffect(() => {
    if (!currentUser?.uid || !integrationId) return;
    
    Promise.all([
      fetchIntegration(),
      fetchSubUsers(),
      loadSyncPreferences(),
      loadSavedApiCheckData(),
      loadSyncStatusData(),
      loadApiLogs(1) // Load API logs with page 1
    ]);
  }, [currentUser?.uid, integrationId]);

  const fetchIntegration = useCallback(async () => {
    if (!currentUser?.uid || !integrationId) {
      return;
    }
    setIsLoading(true);
    try {
      const integrationDocRef = doc(db, 'takealotIntegrations', integrationId);
      const integrationDocSnap = await getDoc(integrationDocRef);
      
      if (!integrationDocSnap.exists()) {
        setError('Integration not found.');
        setIntegration(null); 
        return;
      }
      
      const integrationData = integrationDocSnap.data() as TakealotIntegration;
      
      if (integrationData.adminId !== currentUser.uid && integrationData.assignedUserId !== currentUser.uid) {
        setError('Access denied to this integration.');
        setIntegration(null); 
        return;
      }
      
      const integrationWithId = { 
        ...integrationData,
        id: integrationDocSnap.id,
      };

      setIntegration(integrationWithId);
      setAccountName(integrationData.accountName || '');
      setApiKey(integrationData.apiKey || ''); 
      setAssignedUserId(integrationData.assignedUserId || '');

    } catch (err: any) {
      console.error('Error fetching integration:', err);
      setError(`Failed to load integration: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.uid, integrationId, setPageTitle]);

  const fetchSubUsers = useCallback(async () => {
    if (!currentUser?.uid) {
      return;
    }
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('adminId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      
      const subUsersList: SubUser[] = [];
      querySnapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        if (userData.role === UserRole.TakealotUser || userData.role === UserRole.POSUser) {
          subUsersList.push({
            id: docSnap.id,
            name: userData.displayName || userData.email || 'Unnamed User',
            email: userData.email,
            role: userData.role as UserRole,
          });
        }
      });
      setSubUsers(subUsersList);
    } catch (err: any) {
      console.error('Error fetching sub-users:', err);
      setError(`Failed to load sub-users: ${err.message}`);
      setSubUsers([]); 
    }
  }, [currentUser?.uid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!integration || !currentUser?.uid || !integration.id) {
      setError('Cannot save: Integration data, user session, or Integration ID is missing.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const assignedUser = subUsers.find(user => user.id === assignedUserId);
      const currentAssignedUserId = assignedUserId || currentUser.uid; 
      const assignedUserName = currentAssignedUserId === currentUser.uid 
        ? 'Admin (Self)' 
        : assignedUser?.name || 'Unknown User';

      const updateData: Partial<TakealotIntegration> = {
        accountName: accountName.trim(),
        apiKey: apiKey.trim(), 
        assignedUserId: currentAssignedUserId,
        assignedUserName: assignedUserName,
        updatedAt: serverTimestamp(), 
      };

      const integrationRef = doc(db, 'takealotIntegrations', integration.id);
      await updateDoc(integrationRef, updateData);
      
      const updatedIntegrationFields = {
        accountName: updateData.accountName!,
        apiKey: updateData.apiKey!,
        assignedUserId: updateData.assignedUserId!,
        assignedUserName: updateData.assignedUserName!,
        updatedAt: new Date() // Approximate client-side update for timestamp
      };
      setIntegration(prev => prev ? { ...prev, ...updatedIntegrationFields } : null);
      if(updateData.accountName && hookIntegration?.accountName !== updateData.accountName) {
        setPageTitle(`Takealot: ${updateData.accountName} - Settings`);
      }

      setSuccess('Integration updated successfully!');
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error updating integration:', err);
      setError(`Failed to update integration: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!integration || !integration.id) {
      setError('Cannot delete: Integration data or ID is missing.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete the integration "${integration.accountName}"? This action cannot be undone and will remove all associated data.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const integrationRef = doc(db, 'takealotIntegrations', integration.id);
      await deleteDoc(integrationRef);
      
      setSuccess('Integration deleted successfully. Redirecting...');
      setTimeout(() => {
        router.push('/admin/integration'); 
      }, 1500);

    } catch (err: any) {
      console.error('Error deleting integration:', err);
      setError(`Failed to delete integration: ${err.message}`);
      setIsDeleting(false); 
    }
  };
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (integrationId && currentUser?.uid) {
        fetchIntegration();
        loadSyncPreferences();
        loadSavedApiCheckData(); // Reload saved API check data periodically
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [integrationId, currentUser?.uid, fetchIntegration]); // Added fetchIntegration to dependencies
  // Handler for checking API connection
  const handleCheckApiConnection = async () => {
    if (!integrationId || !apiKey) {
      showGeneralMessage('error', 'Integration ID or API Key is missing.');
      return;
    }
    setIsCheckingApiConnection(true);
    setApiConnectionResult({ status: 'info', message: 'Checking connection...' });
    try {
      console.log('Sending request to check-connection with:', { integrationId, apiKey: apiKey.substring(0, 10) + '...' });
      
      const response = await fetch('/api/admin/takealot/check-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId, apiKey }),
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response text:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Success response:', result);
      
      if (result.status === 'success') {
        setApiConnectionResult({ status: 'success', message: result.message });
        showGeneralMessage('success', result.message);
      } else {
        setApiConnectionResult({ status: 'error', message: result.message || 'Connection check failed.' });
        showGeneralMessage('error', result.message || 'Connection check failed.');
      }
    } catch (err: any) {
      console.error('Request failed:', err);
      const errorMessage = err.message || 'Unknown error occurred';
      setApiConnectionResult({ status: 'error', message: errorMessage });
      showGeneralMessage('error', `Connection check failed: ${errorMessage}`);
    } finally {
      setIsCheckingApiConnection(false);
      loadSavedApiCheckData(); // Refresh last checked times
    }
  };

  // Handler for checking total products
  const handleCheckTotalProducts = async () => {
    if (!integrationId || !apiKey) {
      showGeneralMessage('error', 'Integration ID or API Key is missing.');
      return;
    }
    setIsCheckingProducts(true);
    setProductCheckResult({ status: 'info', message: 'Checking products...' });
    try {
      const response = await fetch('/api/admin/takealot/check-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId, apiKey }),
      });
      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setProductCheckResult({ 
          status: 'success', 
          message: result.message, 
          totalProducts: result.totalProducts, 
          totalPages: result.totalPages 
        });
        showGeneralMessage('success', result.message);
      } else {
        setProductCheckResult({ status: 'error', message: result.message || 'Product check failed.' });
        showGeneralMessage('error', result.message || 'Product check failed.');
      }
    } catch (err: any) {
      setProductCheckResult({ status: 'error', message: `Error: ${err.message}` });
      showGeneralMessage('error', `Product check request failed: ${err.message}`);
    } finally {
      setIsCheckingProducts(false);
      loadSavedApiCheckData(); // Refresh last checked times
    }
  };

  // Handler for checking sales data
  const handleCheckSalesData = async () => {
    if (!integrationId || !apiKey) {
      showGeneralMessage('error', 'Integration ID or API Key is missing.');
      return;
    }
    setIsCheckingSales(true);
    setSalesCheckResult({ status: 'info', message: 'Checking sales data...' });
    try {
      const response = await fetch('/api/admin/takealot/check-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId, apiKey }),
      });
      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setSalesCheckResult({ 
          status: 'success', 
          message: result.message, 
          totalSales: result.totalSales, 
          totalPages: result.totalPages 
        });
        showGeneralMessage('success', result.message);
      } else {
        setSalesCheckResult({ status: 'error', message: result.message || 'Sales check failed.' });
        showGeneralMessage('error', result.message || 'Sales check failed.');
      }
    } catch (err: any) {
      setSalesCheckResult({ status: 'error', message: `Error: ${err.message}` });
      showGeneralMessage('error', `Sales check request failed: ${err.message}`);    } finally {
      setIsCheckingSales(false);
      loadSavedApiCheckData(); // Refresh last checked times
    }  };

  // Optimized fetch operation with intelligent batch processing for large datasets
  const handleOptimizedFetch = async (strategyId: string, strategyDescription: string, type: 'sales' | 'products') => {
    if (!integrationId) {
      showGeneralMessage('error', 'Integration ID is missing.');
      return;
    }

    // Initialize operation state
    const operationKey = `${type}_${strategyId}`;
    setFetchOperations(prev => ({
      ...prev,
      [operationKey]: {
        isRunning: true,
        progress: 0,
        message: 'Starting optimized fetch operation...',
        logs: [`Starting ${strategyDescription} optimized fetch...`],
        totalFetched: 0,
        totalSaved: 0,
        totalUpdated: 0,
        newRecords: 0
      }
    }));

    try {
      // Determine fetch options based on strategy
      let fetchOptions: any = {
        type,
        verifyExisting: true
      };

      // Determine if we should use batch processing for larger datasets
      let useBatchProcessing = false;

      // Configure options based on strategy
      switch (strategyId) {
        case 'sls_100':
        case 'prd_100_3h':
          fetchOptions.limit = 100;
          break;
        case 'prd_200_man':
          fetchOptions.limit = 200;
          break;
        case 'sls_30d':
          fetchOptions.days = 30;
          fetchOptions.batchSize = 10; // Fetch 10 pages per batch
          useBatchProcessing = true;
          break;
        case 'sls_6m':
          fetchOptions.days = 180;
          fetchOptions.batchSize = 15; // Larger batches for bigger datasets
          useBatchProcessing = true;
          break;
        case 'sls_all':
          fetchOptions.batchSize = 20; // Even larger batches for all data
          useBatchProcessing = true;
          break;
        case 'prd_all_6h':
        case 'prd_all_12h':
          fetchOptions.batchSize = 15; // Batch processing for all products
          useBatchProcessing = true;
          break;
      }

      console.log(`Starting optimized fetch with options:`, fetchOptions, `Batch processing: ${useBatchProcessing}`);

      // Choose the appropriate endpoint based on expected dataset size
      const endpoint = useBatchProcessing 
        ? '/api/admin/takealot/optimized-batch-fetch'
        : '/api/admin/takealot/optimized-fetch-100';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          options: fetchOptions
        }),
      });

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              setFetchOperations(prev => ({
                ...prev,
                [operationKey]: {
                  isRunning: !data.completed,
                  progress: data.progress || 0,
                  message: data.message || 'Processing...',
                  logs: [...(prev[operationKey]?.logs || []), data.log || data.message].slice(-10),
                  totalFetched: data.summary?.fetchedFromAPI || data.totalFetched || 0,
                  totalSaved: data.totalNew || 0,
                  totalUpdated: data.totalUpdated || 0,
                  newRecords: data.totalNew || 0
                }
              }));

              if (data.completed) {
                if (data.error) {
                  showGeneralMessage('error', `Optimized fetch failed: ${data.message}`);
                  saveSyncStatus(strategyId, {
                    totalFetched: data.summary?.fetchedFromAPI || data.totalFetched || 0,
                    totalSaved: data.totalNew || 0,
                    totalUpdated: data.totalUpdated || 0,
                    newRecords: data.totalNew || 0,
                    totalPages: data.pages || data.summary?.pages || 1,
                    status: 'error'
                  });
                } else {
                  const message = `${strategyDescription} completed! ${data.totalNew || 0} new, ${data.totalUpdated || 0} updated, ${data.totalSkipped || 0} unchanged${data.pages ? ` (${data.pages} pages)` : ''}`;
                  showGeneralMessage('success', message);
                  
                  saveSyncStatus(strategyId, {
                    totalFetched: data.summary?.fetchedFromAPI || data.totalFetched || 0,
                    totalSaved: data.totalNew || 0,
                    totalUpdated: data.totalUpdated || 0,
                    newRecords: data.totalNew || 0,
                    totalPages: data.pages || data.summary?.pages || 1,
                    status: 'success'
                  });
                  
                  // Reload API logs and sync status data to ensure UI reflects latest data
                  setTimeout(() => {
                    loadApiLogs();
                    loadSyncStatusData();
                  }, 1000); // Small delay to ensure database writes complete
                }
                break;
              }
            } catch (error) {
              console.error('Error parsing optimized fetch data:', error);
            }
          }
        }
      }

    } catch (error: any) {
      console.error('Optimized fetch operation error:', error);
      showGeneralMessage('error', `Optimized fetch operation failed: ${error.message}`);
      
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

  // Regular fetch operation handler (now optimized for all strategies)
  const handleFetchOperation = async (strategyId: string, strategyDescription: string, type: 'sales' | 'products') => {
    // Use optimized fetch for ALL PRODUCT strategies and ALL SALES strategies to prevent duplicates
    if (type === 'products' || type === 'sales') {
      return handleOptimizedFetch(strategyId, strategyDescription, type);
    }

    if (!integrationId) {
      showGeneralMessage('error', 'Integration ID is missing.');
      return;
    }

    // Initialize operation state
    const operationKey = `${type}_${strategyId}`;
    setFetchOperations(prev => ({
      ...prev,
      [operationKey]: {
        isRunning: true,
        progress: 0,
        message: 'Starting fetch operation...',
        logs: [`Starting ${strategyDescription} fetch...`],
        totalFetched: 0,
        totalSaved: 0,
        totalUpdated: 0,
        newRecords: 0
      }
    }));

    try {
      // Determine fetch options based on strategy
      let fetchOptions: any = {
        type: type === 'products' ? 'offers' : 'sales',
        batchMode: true,
        testMode: false
      };

      // Configure based on strategy
      switch (strategyId) {
        case 'sls_30d':
          fetchOptions.days = 30;
          break;
        case 'sls_6m':
          fetchOptions.days = 180;
          break;
        case 'sls_all':
          // No limit, fetch all
          break;
        case 'prd_200_man':
          fetchOptions.limit = 200;
          break;
        case 'prd_all_6h':
        case 'prd_all_12h':
          // No limit, fetch all
          break;
      }

      console.log('Starting fetch with options:', fetchOptions);// Make the fetch request with streaming response
      const response = await fetch('/api/admin/takealot/simple-fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          options: fetchOptions
        }),
      });

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              setFetchOperations(prev => ({
                ...prev,
                [operationKey]: {
                  isRunning: !data.completed,
                  progress: data.progress || 0,
                  message: data.message || 'Processing...',
                  logs: [...(prev[operationKey]?.logs || []), data.log || data.message].slice(-10) // Keep last 10 logs
                }
              }));              if (data.completed) {
                console.log('Fetch operation completed with data:', data); // Debug log
                
                if (data.error) {
                  showGeneralMessage('error', `Fetch failed: ${data.message}`);
                  // Save error status
                  saveSyncStatus(strategyId, {
                    totalFetched: data.recordsProcessed || 0,
                    totalSaved: data.recordsProcessed || 0, // For now, assume all fetched records are saved
                    totalPages: data.pagesFetched || data.summary?.pagesFetched || 1,
                    status: 'error'
                  });
                } else {
                  showGeneralMessage('success', `${strategyDescription} completed successfully!`);
                  // Save success status with correct API response field names
                  const totalFetched = data.recordsProcessed || 0;
                  const totalSaved = data.recordsProcessed || 0; // API saves all fetched records unless testMode
                  const totalPages = data.pagesFetched || data.summary?.pagesFetched || 1;
                  
                  console.log('Saving sync status with correct field mapping:', { totalFetched, totalSaved, totalPages }); // Debug log
                  
                  saveSyncStatus(strategyId, {
                    totalFetched,
                    totalSaved,
                    totalPages,
                    status: 'success'
                  });
                  // Reload API logs to show the new operation
                  loadApiLogs();
                }
                break;
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }

    } catch (error: any) {
      console.error('Fetch operation error:', error);
      showGeneralMessage('error', `Fetch operation failed: ${error.message}`);
      
      setFetchOperations(prev => ({
        ...prev,
        [operationKey]: {
          isRunning: false,
          progress: 0,
          message: `Error: ${error.message}`,
          logs: [...(prev[operationKey]?.logs || []), `Error: ${error.message}`]
        }
      }));
    }
  };  // Save sync status data after successful fetch operation
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
      console.log(`Saving sync status for strategy ${strategyId}:`, data); // Debug log
      
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
      
      console.log(`Successfully saved sync status for strategy ${strategyId}`); // Debug log
      
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
      
      console.log(`Updated local sync state for strategy ${strategyId}`); // Debug log
    } catch (error: any) {
      console.error("Failed to save sync status:", error);
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
    }  };

  // Helper function to get sync status display data
  const getSyncStatusDisplay = (strategyId: string) => {
    const status = syncStatusData[strategyId];
    
    if (!status || !status.lastSync) {
      return {
        lastSyncText: 'Not Available',
        lastSyncColor: 'text-orange-600',
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
    }    const result = {
      lastSyncText,
      lastSyncColor,
      totalFetched: status.totalFetched,
      totalSaved: status.totalSaved,
      totalUpdated: status.totalUpdated,
      newRecords: status.newRecords,
      totalPages: status.totalPages
    };
    return result;
  };

  // Handle duplicate cleanup operations (sales and products)
  const handleDuplicateCleanup = async (type: 'sales' | 'products') => {
    if (!integrationId) {
      showGeneralMessage('error', 'Integration ID is missing.');
      return;
    }

    const endpoint = type === 'sales' 
      ? '/api/admin/takealot/fix-duplicate-sales'
      : '/api/admin/takealot/fix-duplicate-products';

    const operationKey = `duplicate_${type}`;
    const confirmMessage = type === 'sales'
      ? 'Are you sure you want to remove duplicate sales records? This will delete sales with duplicate Order IDs.'
      : 'Are you sure you want to remove duplicate products? This will delete products with duplicate TSIN IDs.';

    if (!confirm(confirmMessage)) {
      return;
    }

    // Initialize cleanup operation state
    setCleanupOperations(prev => ({
      ...prev,
      [operationKey]: {
        isRunning: true,
        progress: 0,
        message: 'Starting cleanup operation...',
        logs: [`Starting ${type} duplicate removal...`],
        duplicatesRemoved: 0,
        batchesProcessed: 0,
        totalRemaining: 0
      }
    }));

    try {
      console.log(`Starting ${type} duplicate cleanup`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ integrationId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              setCleanupOperations(prev => ({
                ...prev,
                [operationKey]: {
                  isRunning: !data.completed,
                  progress: data.progress || 0,
                  message: data.message || 'Processing...',
                  logs: [...(prev[operationKey]?.logs || []), data.log || data.message].slice(-10),
                  duplicatesRemoved: data.duplicatesRemoved || 0,
                  batchesProcessed: data.batchesProcessed || 0,
                  totalRemaining: data.totalRemaining || 0
                }
              }));

              if (data.completed) {
                if (data.error) {
                  showGeneralMessage('error', `${type} cleanup failed: ${data.message}`);
                } else {
                  const message = `${type} cleanup completed! Removed ${data.duplicatesRemoved || 0} duplicates, ${data.totalRemaining || 0} records remain`;
                  showGeneralMessage('success', message);
                  
                  // Save cleanup result for display
                  setCleanupOperations(prev => ({
                    ...prev,
                    [operationKey]: {
                      ...prev[operationKey],
                      lastResult: {
                        timestamp: new Date().toLocaleString(),
                        duplicatesRemoved: data.duplicatesRemoved || 0,
                        totalRemaining: data.totalRemaining || 0,
                        batchesProcessed: data.batchesProcessed || 0
                      }
                    }
                  }));
                  
                  // Reload API logs
                  loadApiLogs();
                }
                break;
              }
            } catch (error) {
              console.error('Error parsing cleanup data:', error);
            }
          }
        }
      }

    } catch (error: any) {
      console.error(`${type} cleanup operation error:`, error);
      showGeneralMessage('error', `${type} cleanup operation failed: ${error.message}`);
      
      setCleanupOperations(prev => ({
        ...prev,
        [operationKey]: {
          isRunning: false,
          progress: 0,
          message: `Error: ${error.message}`,
          logs: [...(prev[operationKey]?.logs || []), `Error: ${error.message}`],
          duplicatesRemoved: 0,
          batchesProcessed: 0,
          totalRemaining: 0
        }
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading integration settings...</span>
      </div>
    );
  }
  if (!integration) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-red-800 mb-2">Integration Not Found</h3>
        <p className="text-red-600">The requested integration could not be found or you don't have access to it.</p>
      </div>
    );
  }
  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* New Settings Page Test Button */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-1">🚀 New Modular Settings Available</h3>
            <p className="text-blue-700 text-sm">
              Test the new component-based settings page with organized tabs and improved UX.
            </p>
          </div>
          <button
            onClick={() => router.push(`/admin/takealot/${integrationId}/settings`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Try Main Settings →
          </button>
        </div>
      </div>
      {/* Success/Error Messages */}
      {generalUIMessage.type && (
        <div className={`p-4 rounded-xl border shadow-sm ${
          generalUIMessage.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-3 ${
              generalUIMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="font-medium">{generalUIMessage.text}</span>
          </div>
        </div>
      )}{/* Integration Settings Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Integration Settings</h2>
            <p className="text-sm text-gray-600">Configure your Takealot API integration settings</p>
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <FiTrash2 className="w-4 h-4 mr-2 inline" />
            {isDeleting ? 'Deleting...' : 'Delete Integration'}
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Account Name
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
              placeholder="Enter your Takealot account name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
              placeholder="Enter your Takealot API key"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Assigned User
            </label>
            <select
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm bg-white"
            >
              <option value={currentUser.uid}>Admin (Self)</option>
              {subUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email}) - {user.role}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <FiSave className="w-4 h-4 mr-2 inline" />
              {isSaving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>      {/* API & Data Checks Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="border-b border-gray-100 pb-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">API & Data Checks</h2>
          <p className="text-sm text-gray-600">Test your API connection and retrieve key metrics from Takealot</p>
        </div><div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* API Connection Check */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-blue-500 rounded-xl shadow-sm">
                <FiZap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">API Connection</h3>
                <p className="text-xs text-gray-600">Verify authentication</p>
              </div>
            </div>
            
            {lastCheckedTimes.connection && (
              <p className="text-xs text-gray-500 mb-4 bg-white/50 rounded px-2 py-1">
                Last: {new Date(lastCheckedTimes.connection.seconds * 1000).toLocaleString()}
              </p>
            )}
            
            <button
              onClick={handleCheckApiConnection}
              disabled={isCheckingApiConnection || !apiKey}
              className={`w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm ${
                isCheckingApiConnection || !apiKey
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              {isCheckingApiConnection ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Checking...</span>
                </div>
              ) : (
                'Test Connection'
              )}
            </button>
            
            {apiConnectionResult.message && (
              <div className={`mt-4 p-3 rounded-xl text-sm shadow-inner ${
                apiConnectionResult.status === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    apiConnectionResult.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <p className="font-medium">{apiConnectionResult.message}</p>
                </div>
              </div>
            )}
          </div>

          {/* Products Check */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-purple-500 rounded-xl shadow-sm">
                <FiPackage className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Product Catalog</h3>
                <p className="text-xs text-gray-600">Total products & pages</p>
              </div>
            </div>
            
            {lastCheckedTimes.products && (
              <p className="text-xs text-gray-500 mb-4 bg-white/50 rounded px-2 py-1">
                Last: {new Date(lastCheckedTimes.products.seconds * 1000).toLocaleString()}
              </p>
            )}
            
            <button
              onClick={handleCheckTotalProducts}
              disabled={isCheckingProducts || !apiKey}
              className={`w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm ${
                isCheckingProducts || !apiKey
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
              } focus:outline-none focus:ring-2 focus:ring-purple-500`}
            >
              {isCheckingProducts ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Fetching...</span>
                </div>
              ) : (
                'Check Products'
              )}
            </button>
            
            {productCheckResult.message && (
              <div className={`mt-4 p-3 rounded-xl text-sm shadow-inner ${
                productCheckResult.status === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${
                    productCheckResult.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <p className="font-medium">{productCheckResult.message}</p>
                </div>
                {productCheckResult.status === 'success' && productCheckResult.totalProducts !== undefined && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/70 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-600">Products</p>
                      <p className="text-lg font-bold text-purple-700">{productCheckResult.totalProducts?.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-600">Pages</p>
                      <p className="text-lg font-bold text-purple-700">{productCheckResult.totalPages?.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sales Check */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-emerald-500 rounded-xl shadow-sm">
                <FiTrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Sales Overview</h3>
                <p className="text-xs text-gray-600">Recent sales activity</p>
              </div>
            </div>
            
            {lastCheckedTimes.sales && (
              <p className="text-xs text-gray-500 mb-4 bg-white/50 rounded px-2 py-1">
                Last: {new Date(lastCheckedTimes.sales.seconds * 1000).toLocaleString()}
              </p>
            )}
            
            <button
              onClick={handleCheckSalesData}
              disabled={isCheckingSales || !apiKey}
              className={`w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm ${
                isCheckingSales || !apiKey
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            >
              {isCheckingSales ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Fetching...</span>
                </div>
              ) : (
                'Check Sales'
              )}
            </button>
            
            {salesCheckResult.message && (
              <div className={`mt-4 p-3 rounded-xl text-sm shadow-inner ${
                salesCheckResult.status === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${
                    salesCheckResult.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <p className="font-medium">{salesCheckResult.message}</p>
                </div>
                {salesCheckResult.status === 'success' && salesCheckResult.totalSales !== undefined && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/70 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-600">Sales</p>
                      <p className="text-lg font-bold text-emerald-700">{salesCheckResult.totalSales?.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-600">Pages</p>
                      <p className="text-lg font-bold text-emerald-700">{salesCheckResult.totalPages?.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>      {/* Sync Strategy Preferences Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Sync Strategy Preferences</h2>
            <p className="text-sm text-gray-600">Configure automatic and manual data synchronization strategies</p>
          </div>
          <button
            onClick={handleSaveSyncPreferences}
            disabled={savingSyncPrefs}
            className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
          >
            <FiSave className="w-4 h-4 mr-2 inline" />
            {savingSyncPrefs ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sales Data Strategies */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              Sales Data Strategies
            </h3>            {/* Last 100 Sales - Enhanced with Optimization */}
            <div className="optimized-card bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 mb-4 border border-blue-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-sm text-gray-800 flex items-center">
                    Last 100 
                    <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                      Optimized
                    </span>
                  </p>
                  <p className="text-xs text-blue-600 font-medium">Default: Every 1 hr</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={salesStrategies.find(s => s.id === 'sls_100')?.cronEnabled || false}
                      onChange={() => handleStrategyToggle('sales', 'sls_100')} 
                    />
                    <div className={`block w-11 h-6 rounded-full shadow-inner transition-colors ${salesStrategies.find(s => s.id === 'sls_100')?.cronEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${salesStrategies.find(s => s.id === 'sls_100')?.cronEnabled ? 'translate-x-full' : ''}`}></div>
                  </div>                </label>
              </div>
              
              <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                <div className="text-gray-700 font-medium text-xs mb-2">
                  Last Sync: <span className={getSyncStatusDisplay('sls_100').lastSyncColor}>{getSyncStatusDisplay('sls_100').lastSyncText}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-gray-600">Fetched: <span className="font-semibold text-blue-600">{getSyncStatusDisplay('sls_100').totalFetched}</span></div>
                    <div className="text-gray-600">New: <span className="font-semibold text-green-600">{getSyncStatusDisplay('sls_100').newRecords}</span></div>
                  </div>
                  <div>
                    <div className="text-gray-600">Updated: <span className="font-semibold text-orange-600">{getSyncStatusDisplay('sls_100').totalUpdated}</span></div>
                    <div className="text-gray-600">Pages: <span className="font-semibold">{getSyncStatusDisplay('sls_100').totalPages}</span></div>
                  </div>
                </div>                {(fetchOperations['sales_sls_100']?.totalUpdated ?? 0) > 0 && (
                  <div className="mt-2 px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                    <strong>Data Updated:</strong> {fetchOperations['sales_sls_100']?.totalUpdated} sales status/amounts updated
                  </div>
                )}
              </div>
                <button 
                onClick={() => handleFetchOperation('sls_100', 'Last 100 Sales', 'sales')}
                disabled={fetchOperations['sales_sls_100']?.isRunning}
                className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                  fetchOperations['sales_sls_100']?.isRunning
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                }`}
              >
                {fetchOperations['sales_sls_100']?.isRunning ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>{fetchOperations['sales_sls_100']?.message || 'Optimizing...'}</span>
                  </div>                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <FiZap className="w-4 h-4" />
                    <span>Sync & Optimize</span>
                  </div>
                )}
              </button>
              
              {fetchOperations['sales_sls_100']?.isRunning && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Progress</span>
                    <span>{fetchOperations['sales_sls_100']?.progress || 0}%</span>
                  </div>                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full progress-bar transition-all duration-300"
                      style={{ width: `${fetchOperations['sales_sls_100']?.progress || 0}%` }}
                    ></div>
                  </div>
                  
                  {/* Enhanced Progress Details */}
                  <div className="grid grid-cols-3 gap-2 text-xs slide-up">
                    <div className="text-center p-2 bg-green-50 rounded border">
                      <div className="font-semibold text-green-600">{fetchOperations['sales_sls_100']?.newRecords || 0}</div>
                      <div className="text-gray-600">New</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded border">
                      <div className="font-semibold text-orange-600">{fetchOperations['sales_sls_100']?.totalUpdated || 0}</div>
                      <div className="text-gray-600">Updated</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded border">
                      <div className="font-semibold text-blue-600">{fetchOperations['sales_sls_100']?.totalFetched || 0}</div>
                      <div className="text-gray-600">Fetched</div>
                    </div>
                  </div>
                  
                  {fetchOperations['sales_sls_100']?.logs?.length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                      {fetchOperations['sales_sls_100'].logs[fetchOperations['sales_sls_100'].logs.length - 1]}
                    </div>
                  )}
                </div>
              )}
            </div>            {/* Last 30 Days */}
            <div className="optimized-card bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-5 mb-4 border border-purple-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-sm text-gray-800">Last 30 Days</p>
                  <p className="text-xs text-purple-600 font-medium">Default: Every Night</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={salesStrategies.find(s => s.id === 'sls_30d')?.cronEnabled || false}
                      onChange={() => handleStrategyToggle('sales', 'sls_30d')} 
                    />
                    <div className={`block w-11 h-6 rounded-full shadow-inner transition-colors ${salesStrategies.find(s => s.id === 'sls_30d')?.cronEnabled ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${salesStrategies.find(s => s.id === 'sls_30d')?.cronEnabled ? 'translate-x-full' : ''}`}></div>
                  </div>
                </label>
              </div>                <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                <div className="text-gray-700 font-medium text-xs mb-2">
                  Last Sync: <span className={getSyncStatusDisplay('sls_30d').lastSyncColor}>{getSyncStatusDisplay('sls_30d').lastSyncText}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-gray-600">Fetched: <span className="font-semibold text-purple-600">{getSyncStatusDisplay('sls_30d').totalFetched}</span></div>
                    <div className="text-gray-600">New: <span className="font-semibold text-green-600">{getSyncStatusDisplay('sls_30d').newRecords}</span></div>
                  </div>
                  <div>
                    <div className="text-gray-600">Updated: <span className="font-semibold text-orange-600">{getSyncStatusDisplay('sls_30d').totalUpdated}</span></div>
                    <div className="text-gray-600">Pages: <span className="font-semibold">{getSyncStatusDisplay('sls_30d').totalPages}</span></div>
                  </div>
                </div>
              </div>
                <button 
                onClick={() => handleFetchOperation('sls_30d', 'Last 30 Days Sales', 'sales')}
                disabled={fetchOperations['sales_sls_30d']?.isRunning}
                className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                  fetchOperations['sales_sls_30d']?.isRunning
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white'
                }`}
              >                {fetchOperations['sales_sls_30d']?.isRunning ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>{fetchOperations['sales_sls_30d']?.message || 'Fetching...'}</span>
                  </div>
                ) : (
                  'Sync & Optimize'
                )}
              </button>
                {fetchOperations['sales_sls_30d']?.isRunning && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Progress</span>
                    <span>{fetchOperations['sales_sls_30d']?.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full progress-bar transition-all duration-300"
                      style={{ width: `${fetchOperations['sales_sls_30d']?.progress || 0}%` }}
                    ></div>
                  </div>
                  
                  {/* Enhanced Progress Details */}
                  <div className="grid grid-cols-3 gap-2 text-xs slide-up">
                    <div className="text-center p-2 bg-green-50 rounded border">
                      <div className="font-semibold text-green-600">{fetchOperations['sales_sls_30d']?.newRecords || 0}</div>
                      <div className="text-gray-600">New</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded border">
                      <div className="font-semibold text-orange-600">{fetchOperations['sales_sls_30d']?.totalUpdated || 0}</div>
                      <div className="text-gray-600">Updated</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded border">
                      <div className="font-semibold text-purple-600">{fetchOperations['sales_sls_30d']?.totalFetched || 0}</div>
                      <div className="text-gray-600">Fetched</div>
                    </div>
                  </div>
                  
                  {fetchOperations['sales_sls_30d']?.logs?.length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                      {fetchOperations['sales_sls_30d'].logs[fetchOperations['sales_sls_30d'].logs.length - 1]}
                    </div>
                  )}
                </div>
              )}
            </div>            {/* Last 6 Months */}
            <div className="optimized-card bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 mb-4 border border-emerald-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-sm text-gray-800">Last 6 Months</p>
                  <p className="text-xs text-emerald-600 font-medium">Default: Every Sunday</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={salesStrategies.find(s => s.id === 'sls_6m')?.cronEnabled || false}
                      onChange={() => handleStrategyToggle('sales', 'sls_6m')} 
                    />
                    <div className={`block w-11 h-6 rounded-full shadow-inner transition-colors ${salesStrategies.find(s => s.id === 'sls_6m')?.cronEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${salesStrategies.find(s => s.id === 'sls_6m')?.cronEnabled ? 'translate-x-full' : ''}`}></div>
                  </div>
                </label>
              </div>                <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                <div className="text-gray-700 font-medium text-xs mb-2">
                  Last Sync: <span className={getSyncStatusDisplay('sls_6m').lastSyncColor}>{getSyncStatusDisplay('sls_6m').lastSyncText}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-gray-600">Fetched: <span className="font-semibold text-emerald-600">{getSyncStatusDisplay('sls_6m').totalFetched}</span></div>
                    <div className="text-gray-600">New: <span className="font-semibold text-green-600">{getSyncStatusDisplay('sls_6m').newRecords}</span></div>
                  </div>
                  <div>
                    <div className="text-gray-600">Updated: <span className="font-semibold text-orange-600">{getSyncStatusDisplay('sls_6m').totalUpdated}</span></div>
                    <div className="text-gray-600">Pages: <span className="font-semibold">{getSyncStatusDisplay('sls_6m').totalPages}</span></div>
                  </div>
                </div>
              </div>
                <button 
                onClick={() => handleFetchOperation('sls_6m', 'Last 6 Months Sales', 'sales')}
                disabled={fetchOperations['sales_sls_6m']?.isRunning}
                className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                  fetchOperations['sales_sls_6m']?.isRunning
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                }`}
              >                {fetchOperations['sales_sls_6m']?.isRunning ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>{fetchOperations['sales_sls_6m']?.message || 'Fetching...'}</span>
                  </div>
                ) : (
                  'Sync & Optimize'
                )}
              </button>
                {fetchOperations['sales_sls_6m']?.isRunning && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Progress</span>
                    <span>{fetchOperations['sales_sls_6m']?.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-emerald-600 h-2 rounded-full progress-bar transition-all duration-300"
                      style={{ width: `${fetchOperations['sales_sls_6m']?.progress || 0}%` }}
                    ></div>
                  </div>
                  
                  {/* Enhanced Progress Details */}
                  <div className="grid grid-cols-3 gap-2 text-xs slide-up">
                    <div className="text-center p-2 bg-green-50 rounded border">
                      <div className="font-semibold text-green-600">{fetchOperations['sales_sls_6m']?.newRecords || 0}</div>
                      <div className="text-gray-600">New</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded border">
                      <div className="font-semibold text-orange-600">{fetchOperations['sales_sls_6m']?.totalUpdated || 0}</div>
                      <div className="text-gray-600">Updated</div>
                    </div>
                    <div className="text-center p-2 bg-emerald-50 rounded border">
                      <div className="font-semibold text-emerald-600">{fetchOperations['sales_sls_6m']?.totalFetched || 0}</div>
                      <div className="text-gray-600">Fetched</div>
                    </div>
                  </div>
                  
                  {fetchOperations['sales_sls_6m']?.logs?.length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                      {fetchOperations['sales_sls_6m'].logs[fetchOperations['sales_sls_6m'].logs.length - 1]}
                    </div>
                  )}
                </div>
              )}
            </div>            {/* All Data */}
            <div className="optimized-card bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-5 mb-4 border border-rose-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-sm text-gray-800">All Data</p>
                  <p className="text-xs text-rose-600 font-medium">Default: Manually</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={salesStrategies.find(s => s.id === 'sls_all')?.cronEnabled || false}
                      onChange={() => handleStrategyToggle('sales', 'sls_all')} 
                    />
                    <div className={`block w-11 h-6 rounded-full shadow-inner transition-colors ${salesStrategies.find(s => s.id === 'sls_all')?.cronEnabled ? 'bg-rose-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${salesStrategies.find(s => s.id === 'sls_all')?.cronEnabled ? 'translate-x-full' : ''}`}></div>
                  </div>                </label>
              </div>
                <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                <div className="text-gray-700 font-medium text-xs mb-2">
                  Last Sync: <span className={getSyncStatusDisplay('sls_all').lastSyncColor}>{getSyncStatusDisplay('sls_all').lastSyncText}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-gray-600">Fetched: <span className="font-semibold text-rose-600">{getSyncStatusDisplay('sls_all').totalFetched}</span></div>
                    <div className="text-gray-600">New: <span className="font-semibold text-green-600">{getSyncStatusDisplay('sls_all').newRecords}</span></div>
                  </div>
                  <div>
                    <div className="text-gray-600">Updated: <span className="font-semibold text-orange-600">{getSyncStatusDisplay('sls_all').totalUpdated}</span></div>
                    <div className="text-gray-600">Pages: <span className="font-semibold">{getSyncStatusDisplay('sls_all').totalPages}</span></div>
                  </div>
                </div>
              </div>
                <button 
                onClick={() => handleFetchOperation('sls_all', 'All Sales Data', 'sales')}
                disabled={fetchOperations['sales_sls_all']?.isRunning}
                className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                  fetchOperations['sales_sls_all']?.isRunning
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white'
                }`}
              >                {fetchOperations['sales_sls_all']?.isRunning ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>{fetchOperations['sales_sls_all']?.message || 'Fetching...'}</span>
                  </div>
                ) : (
                  'Sync & Optimize'
                )}
              </button>
              
              {fetchOperations['sales_sls_all']?.isRunning && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{fetchOperations['sales_sls_all']?.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-rose-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${fetchOperations['sales_sls_all']?.progress || 0}%` }}
                    ></div>
                  </div>
                  {fetchOperations['sales_sls_all']?.logs?.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                      {fetchOperations['sales_sls_all'].logs[fetchOperations['sales_sls_all'].logs.length - 1]}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>          {/* Product Data Strategies */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
              Product Data Strategies
            </h3>            {/* Fetch 100 Products - Enhanced with Optimization and TSIN-based Updates */}
            <div className="optimized-card bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-5 mb-4 border border-indigo-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">                <div>
                  <p className="font-semibold text-sm text-gray-800 flex items-center">
                    Fetch 100 Products
                    <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                      Optimized
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">Default: Manually</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={productStrategies.find(s => s.id === 'prd_100_3h')?.cronEnabled || false}
                      onChange={() => handleStrategyToggle('products', 'prd_100_3h')} 
                    />
                    <div className={`block w-11 h-6 rounded-full shadow-inner transition-colors ${productStrategies.find(s => s.id === 'prd_100_3h')?.cronEnabled ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${productStrategies.find(s => s.id === 'prd_100_3h')?.cronEnabled ? 'translate-x-full' : ''}`}></div>
                  </div>                </label>
              </div>                <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                <div className="text-gray-700 font-medium text-xs mb-2">
                  Last Sync: <span className={
                    fetchOperations['products_prd_100_3h']?.isRunning 
                      ? 'text-blue-600' 
                      : getSyncStatusDisplay('prd_100_3h').lastSyncColor
                  }>
                    {fetchOperations['products_prd_100_3h']?.isRunning 
                      ? 'Running...' 
                      : getSyncStatusDisplay('prd_100_3h').lastSyncText}
                  </span>
                </div>                {!fetchOperations['products_prd_100_3h']?.isRunning ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-gray-600">Fetched: <span className="font-semibold text-indigo-600">
                        {fetchOperations['products_prd_100_3h']?.totalFetched ?? getSyncStatusDisplay('prd_100_3h').totalFetched}
                      </span></div>
                      <div className="text-gray-600">New: <span className="font-semibold text-green-600">
                        {fetchOperations['products_prd_100_3h']?.newRecords ?? getSyncStatusDisplay('prd_100_3h').newRecords}
                      </span></div>
                    </div>
                    <div>
                      <div className="text-gray-600">Updated: <span className="font-semibold text-orange-600">
                        {fetchOperations['products_prd_100_3h']?.totalUpdated ?? getSyncStatusDisplay('prd_100_3h').totalUpdated}
                      </span></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-blue-600 italic">
                    Processing products... Please wait for results.
                  </div>
                )}{((fetchOperations['products_prd_100_3h']?.newRecords ?? 0) > 0 || (fetchOperations['products_prd_100_3h']?.totalUpdated ?? 0) > 0) && (
                  <div className="mt-2 space-y-1">
                    {(fetchOperations['products_prd_100_3h']?.newRecords ?? 0) > 0 && (
                      <div className="px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        <strong>New Products:</strong> {fetchOperations['products_prd_100_3h']?.newRecords} created with TSIN
                      </div>
                    )}
                    {(fetchOperations['products_prd_100_3h']?.totalUpdated ?? 0) > 0 && (
                      <div className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                        <strong>Updated:</strong> {fetchOperations['products_prd_100_3h']?.totalUpdated} products (Price, RRP, SKU, Image, Quantity)
                      </div>
                    )}
                  </div>
                )}
              </div>
                <button 
                onClick={() => handleFetchOperation('prd_100_3h', 'Fetch 100 Products', 'products')}
                disabled={fetchOperations['products_prd_100_3h']?.isRunning}
                className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                  fetchOperations['products_prd_100_3h']?.isRunning
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white'
                }`}
              >                {fetchOperations['products_prd_100_3h']?.isRunning ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>{fetchOperations['products_prd_100_3h']?.message || 'Optimizing...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <FiPackage className="w-4 h-4" />
                    <span>Sync & Optimize</span>
                  </div>
                )}
              </button>
              
              {fetchOperations['products_prd_100_3h']?.isRunning && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Progress</span>
                    <span>{fetchOperations['products_prd_100_3h']?.progress || 0}%</span>
                  </div>                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full progress-bar transition-all duration-300"
                      style={{ width: `${fetchOperations['products_prd_100_3h']?.progress || 0}%` }}
                    ></div>
                  </div>
                  
                  {/* Enhanced Progress Details */}
                  <div className="grid grid-cols-3 gap-2 text-xs slide-up">
                    <div className="text-center p-2 bg-green-50 rounded border">
                      <div className="font-semibold text-green-600">{fetchOperations['products_prd_100_3h']?.newRecords || 0}</div>
                      <div className="text-gray-600">New</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded border">
                      <div className="font-semibold text-orange-600">{fetchOperations['products_prd_100_3h']?.totalUpdated || 0}</div>
                      <div className="text-gray-600">Updated</div>
                    </div>
                    <div className="text-center p-2 bg-indigo-50 rounded border">
                      <div className="font-semibold text-indigo-600">{fetchOperations['products_prd_100_3h']?.totalFetched || 0}</div>
                      <div className="text-gray-600">Fetched</div>
                    </div>
                  </div>
                  
                  {fetchOperations['products_prd_100_3h']?.logs?.length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                      {fetchOperations['products_prd_100_3h'].logs[fetchOperations['products_prd_100_3h'].logs.length - 1]}
                    </div>
                  )}
                </div>
              )}
            </div>            {/* Fetch & Optimize 200 Products */}
            <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-xl p-5 mb-4 border border-cyan-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-sm text-gray-800">Fetch & Optimize 200</p>
                  <p className="text-xs text-cyan-600 font-medium">TSIN-based duplicate prevention</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={productStrategies.find(s => s.id === 'prd_200_man')?.cronEnabled || false}
                      onChange={() => handleStrategyToggle('products', 'prd_200_man')} 
                    />
                    <div className={`block w-11 h-6 rounded-full shadow-inner transition-colors ${productStrategies.find(s => s.id === 'prd_200_man')?.cronEnabled ? 'bg-cyan-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${productStrategies.find(s => s.id === 'prd_200_man')?.cronEnabled ? 'translate-x-full' : ''}`}></div>
                  </div>
                </label>
              </div>              <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                <div className="text-gray-700 font-medium text-xs mb-2">
                  Last Sync: <span className={
                    fetchOperations['products_prd_200_man']?.isRunning 
                      ? 'text-blue-600' 
                      : getSyncStatusDisplay('prd_200_man').lastSyncColor
                  }>
                    {fetchOperations['products_prd_200_man']?.isRunning 
                      ? 'Running...' 
                      : getSyncStatusDisplay('prd_200_man').lastSyncText}
                  </span>
                </div>

                {!fetchOperations['products_prd_200_man']?.isRunning ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-gray-600">Fetched: <span className="font-semibold text-cyan-600">
                        {fetchOperations['products_prd_200_man']?.totalFetched ?? getSyncStatusDisplay('prd_200_man').totalFetched}
                      </span></div>
                      <div className="text-gray-600">New: <span className="font-semibold text-green-600">
                        {fetchOperations['products_prd_200_man']?.newRecords ?? getSyncStatusDisplay('prd_200_man').newRecords}
                      </span></div>
                    </div>
                    <div>
                      <div className="text-gray-600">Updated: <span className="font-semibold text-orange-600">
                        {fetchOperations['products_prd_200_man']?.totalUpdated ?? getSyncStatusDisplay('prd_200_man').totalUpdated}
                      </span></div>
                      <div className="text-gray-600">Pages: <span className="font-semibold">{getSyncStatusDisplay('prd_200_man').totalPages}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-blue-600 italic">
                    Processing products... Please wait for results.
                  </div>
                )}

                {((fetchOperations['products_prd_200_man']?.newRecords ?? 0) > 0 || (fetchOperations['products_prd_200_man']?.totalUpdated ?? 0) > 0) && (
                  <div className="mt-2 space-y-1">
                    {(fetchOperations['products_prd_200_man']?.newRecords ?? 0) > 0 && (
                      <div className="px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        <strong>New Products:</strong> {fetchOperations['products_prd_200_man']?.newRecords} created with TSIN
                      </div>
                    )}
                    {(fetchOperations['products_prd_200_man']?.totalUpdated ?? 0) > 0 && (
                      <div className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                        <strong>Updated:</strong> {fetchOperations['products_prd_200_man']?.totalUpdated} products (Price, RRP, SKU, Image, Quantity)
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button 
                onClick={() => handleFetchOperation('prd_200_man', 'Fetch & Optimize 200 Products', 'products')}
                disabled={fetchOperations['products_prd_200_man']?.isRunning}
                className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                  fetchOperations['products_prd_200_man']?.isRunning
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white'
                }`}
              >                {fetchOperations['products_prd_200_man']?.isRunning ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>{fetchOperations['products_prd_200_man']?.message || 'Optimizing...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <FiPackage className="w-4 h-4" />
                    <span>Sync & Optimize</span>
                  </div>
                )}
              </button>

              {fetchOperations['products_prd_200_man']?.isRunning && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Progress</span>
                    <span>{fetchOperations['products_prd_200_man']?.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-cyan-600 h-2 rounded-full progress-bar transition-all duration-300"
                      style={{ width: `${fetchOperations['products_prd_200_man']?.progress || 0}%` }}
                    ></div>
                  </div>

                  {/* Enhanced Progress Details */}
                  <div className="grid grid-cols-3 gap-2 text-xs slide-up">
                    <div className="text-center p-2 bg-green-50 rounded border">
                      <div className="font-semibold text-green-600">{fetchOperations['products_prd_200_man']?.newRecords || 0}</div>
                      <div className="text-gray-600">New</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded border">
                      <div className="font-semibold text-orange-600">{fetchOperations['products_prd_200_man']?.totalUpdated || 0}</div>
                      <div className="text-gray-600">Updated</div>
                    </div>
                    <div className="text-center p-2 bg-cyan-50 rounded border">
                      <div className="font-semibold text-cyan-600">{fetchOperations['products_prd_200_man']?.totalFetched || 0}</div>
                      <div className="text-gray-600">Fetched</div>
                    </div>
                  </div>

                  {fetchOperations['products_prd_200_man']?.logs?.length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                      {fetchOperations['products_prd_200_man'].logs[fetchOperations['products_prd_200_man'].logs.length - 1]}
                    </div>
                  )}
                </div>
              )}
            </div>            {/* Fetch & Optimize All Products - Every 6 hr */}
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-5 mb-4 border border-teal-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-sm text-gray-800">Fetch & Optimize All</p>
                  <p className="text-xs text-teal-600 font-medium">TSIN-based duplicate prevention</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={productStrategies.find(s => s.id === 'prd_all_6h')?.cronEnabled || false}
                      onChange={() => handleStrategyToggle('products', 'prd_all_6h')} 
                    />
                    <div className={`block w-11 h-6 rounded-full shadow-inner transition-colors ${productStrategies.find(s => s.id === 'prd_all_6h')?.cronEnabled ? 'bg-teal-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${productStrategies.find(s => s.id === 'prd_all_6h')?.cronEnabled ? 'translate-x-full' : ''}`}></div>
                  </div>
                </label>
              </div>              <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                <div className="text-gray-700 font-medium text-xs mb-2">
                  Last Sync: <span className={
                    fetchOperations['products_prd_all_6h']?.isRunning 
                      ? 'text-blue-600' 
                      : getSyncStatusDisplay('prd_all_6h').lastSyncColor
                  }>
                    {fetchOperations['products_prd_all_6h']?.isRunning 
                      ? 'Running...' 
                      : getSyncStatusDisplay('prd_all_6h').lastSyncText}
                  </span>
                </div>

                {!fetchOperations['products_prd_all_6h']?.isRunning ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-gray-600">Fetched: <span className="font-semibold text-teal-600">
                        {fetchOperations['products_prd_all_6h']?.totalFetched ?? getSyncStatusDisplay('prd_all_6h').totalFetched}
                      </span></div>
                      <div className="text-gray-600">New: <span className="font-semibold text-green-600">
                        {fetchOperations['products_prd_all_6h']?.newRecords ?? getSyncStatusDisplay('prd_all_6h').newRecords}
                      </span></div>
                    </div>
                    <div>
                      <div className="text-gray-600">Updated: <span className="font-semibold text-orange-600">
                        {fetchOperations['products_prd_all_6h']?.totalUpdated ?? getSyncStatusDisplay('prd_all_6h').totalUpdated}
                      </span></div>
                      <div className="text-gray-600">Pages: <span className="font-semibold">{getSyncStatusDisplay('prd_all_6h').totalPages}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-blue-600 italic">
                    Processing products... Please wait for results.
                  </div>
                )}

                {((fetchOperations['products_prd_all_6h']?.newRecords ?? 0) > 0 || (fetchOperations['products_prd_all_6h']?.totalUpdated ?? 0) > 0) && (
                  <div className="mt-2 space-y-1">
                    {(fetchOperations['products_prd_all_6h']?.newRecords ?? 0) > 0 && (
                      <div className="px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        <strong>New Products:</strong> {fetchOperations['products_prd_all_6h']?.newRecords} created with TSIN
                      </div>
                    )}
                    {(fetchOperations['products_prd_all_6h']?.totalUpdated ?? 0) > 0 && (
                      <div className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                        <strong>Updated:</strong> {fetchOperations['products_prd_all_6h']?.totalUpdated} products (Price, RRP, SKU, Image, Quantity)
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button 
                onClick={() => handleFetchOperation('prd_all_6h', 'Fetch & Optimize All Products (6 hr)', 'products')}
                disabled={fetchOperations['products_prd_all_6h']?.isRunning}
                className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                  fetchOperations['products_prd_all_6h']?.isRunning
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white'
                }`}
              >                {fetchOperations['products_prd_all_6h']?.isRunning ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>{fetchOperations['products_prd_all_6h']?.message || 'Optimizing...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <FiPackage className="w-4 h-4" />
                    <span>Sync & Optimize</span>
                  </div>
                )}
              </button>

              {fetchOperations['products_prd_all_6h']?.isRunning && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Progress</span>
                    <span>{fetchOperations['products_prd_all_6h']?.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-teal-600 h-2 rounded-full progress-bar transition-all duration-300"
                      style={{ width: `${fetchOperations['products_prd_all_6h']?.progress || 0}%` }}
                    ></div>
                  </div>

                  {/* Enhanced Progress Details */}
                  <div className="grid grid-cols-3 gap-2 text-xs slide-up">
                    <div className="text-center p-2 bg-green-50 rounded border">
                      <div className="font-semibold text-green-600">{fetchOperations['products_prd_all_6h']?.newRecords || 0}</div>
                      <div className="text-gray-600">New</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded border">
                      <div className="font-semibold text-orange-600">{fetchOperations['products_prd_all_6h']?.totalUpdated || 0}</div>
                      <div className="text-gray-600">Updated</div>
                    </div>
                    <div className="text-center p-2 bg-teal-50 rounded border">
                      <div className="font-semibold text-teal-600">{fetchOperations['products_prd_all_6h']?.totalFetched || 0}</div>
                      <div className="text-gray-600">Fetched</div>
                    </div>
                  </div>

                  {fetchOperations['products_prd_all_6h']?.logs?.length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                      {fetchOperations['products_prd_all_6h'].logs[fetchOperations['products_prd_all_6h'].logs.length - 1]}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fetch & Optimize All Products - Every 12 hr */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 mb-4 border border-amber-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-sm text-gray-800">Fetch & Optimize All</p>
                  <p className="text-xs text-amber-600 font-medium">TSIN-based duplicate prevention</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={productStrategies.find(s => s.id === 'prd_all_12h')?.cronEnabled || false}
                      onChange={() => handleStrategyToggle('products', 'prd_all_12h')} 
                    />
                    <div className={`block w-11 h-6 rounded-full shadow-inner transition-colors ${productStrategies.find(s => s.id === 'prd_all_12h')?.cronEnabled ? 'bg-amber-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${productStrategies.find(s => s.id === 'prd_all_12h')?.cronEnabled ? 'translate-x-full' : ''}`}></div>
                  </div>
                </label>
              </div>              <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                <div className="text-gray-700 font-medium text-xs mb-2">
                  Last Sync: <span className={
                    fetchOperations['products_prd_all_12h']?.isRunning 
                      ? 'text-blue-600' 
                      : getSyncStatusDisplay('prd_all_12h').lastSyncColor
                  }>
                    {fetchOperations['products_prd_all_12h']?.isRunning 
                      ? 'Running...' 
                      : getSyncStatusDisplay('prd_all_12h').lastSyncText}
                  </span>
                </div>

                {!fetchOperations['products_prd_all_12h']?.isRunning ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-gray-600">Fetched: <span className="font-semibold text-amber-600">
                        {fetchOperations['products_prd_all_12h']?.totalFetched ?? getSyncStatusDisplay('prd_all_12h').totalFetched}
                      </span></div>
                      <div className="text-gray-600">New: <span className="font-semibold text-green-600">
                        {fetchOperations['products_prd_all_12h']?.newRecords ?? getSyncStatusDisplay('prd_all_12h').newRecords}
                      </span></div>
                    </div>
                    <div>
                      <div className="text-gray-600">Updated: <span className="font-semibold text-orange-600">
                        {fetchOperations['products_prd_all_12h']?.totalUpdated ?? getSyncStatusDisplay('prd_all_12h').totalUpdated}
                      </span></div>
                      <div className="text-gray-600">Pages: <span className="font-semibold">{getSyncStatusDisplay('prd_all_12h').totalPages}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-blue-600 italic">
                    Processing products... Please wait for results.
                  </div>
                )}

                {((fetchOperations['products_prd_all_12h']?.newRecords ?? 0) > 0 || (fetchOperations['products_prd_all_12h']?.totalUpdated ?? 0) > 0) && (
                  <div className="mt-2 space-y-1">
                    {(fetchOperations['products_prd_all_12h']?.newRecords ?? 0) > 0 && (
                      <div className="px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        <strong>New Products:</strong> {fetchOperations['products_prd_all_12h']?.newRecords} created with TSIN
                      </div>
                    )}
                    {(fetchOperations['products_prd_all_12h']?.totalUpdated ?? 0) > 0 && (
                      <div className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                        <strong>Updated:</strong> {fetchOperations['products_prd_all_12h']?.totalUpdated} products (Price, RRP, SKU, Image, Quantity)
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button 
                  onClick={() => handleFetchOperation('prd_all_12h', 'Fetch & Optimize All Products (12 hr)', 'products')}
                  disabled={fetchOperations['products_prd_all_12h']?.isRunning}
                  className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                    fetchOperations['products_prd_all_12h']?.isRunning
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white'
                  }`}
                >                  {fetchOperations['products_prd_all_12h']?.isRunning ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>{fetchOperations['products_prd_all_12h']?.message || 'Optimizing...'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <FiPackage className="w-4 h-4" />
                      <span>Sync & Optimize</span>
                    </div>
                  )}
                </button>

              {fetchOperations['products_prd_all_12h']?.isRunning && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Progress</span>
                    <span>{fetchOperations['products_prd_all_12h']?.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-amber-600 h-2 rounded-full progress-bar transition-all duration-300"
                      style={{ width: `${fetchOperations['products_prd_all_12h']?.progress || 0}%` }}
                    ></div>
                  </div>

                  {/* Enhanced Progress Details */}
                  <div className="grid grid-cols-3 gap-2 text-xs slide-up">
                    <div className="text-center p-2 bg-green-50 rounded border">
                      <div className="font-semibold text-green-600">{fetchOperations['products_prd_all_12h']?.newRecords || 0}</div>
                      <div className="text-gray-600">New</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded border">
                      <div className="font-semibold text-orange-600">{fetchOperations['products_prd_all_12h']?.totalUpdated || 0}</div>
                      <div className="text-gray-600">Updated</div>
                    </div>
                    <div className="text-center p-2 bg-amber-50 rounded border">
                      <div className="font-semibold text-amber-600">{fetchOperations['products_prd_all_12h']?.totalFetched || 0}</div>
                      <div className="text-gray-600">Fetched</div>
                    </div>
                  </div>

                  {fetchOperations['products_prd_all_12h']?.logs?.length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                      {fetchOperations['products_prd_all_12h'].logs[fetchOperations['products_prd_all_12h'].logs.length - 1]}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Data Cleanup Section */}
      <DataCleanupCard 
        integrationId={integrationId} 
        showMessage={showGeneralMessage} 
        loadApiLogs={loadApiLogs}
      />

      {/* Sales Data Actions Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="border-b border-gray-100 pb-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sales Data Actions</h2>
          <p className="text-sm text-gray-600">Manage and clean up your sales data</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clear All Sales Data */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-red-500 rounded-xl shadow-sm">
                <FiTrash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Clear All Sales Data</h3>
                <p className="text-xs text-gray-600">Remove all sales records from database</p>
              </div>
            </div>
            
            <button
              onClick={async () => {
                if (!confirm('Are you sure you want to delete ALL sales data? This action cannot be undone.')) {
                  return;
                }
                try {
                  const response = await fetch('/api/admin/takealot/clear-sales-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ integrationId })
                  });
                  const result = await response.json();
                  if (response.ok) {
                    showGeneralMessage('success', result.message || 'All sales data cleared successfully');
                  } else {
                    showGeneralMessage('error', `Failed to clear sales data: ${result.error}`);
                  }
                } catch (error: any) {
                  showGeneralMessage('error', `Error clearing sales data: ${error.message}`);
                }
              }}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Clear All Sales Data
            </button>
          </div>          {/* Remove Duplicate Sales */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-orange-500 rounded-xl shadow-sm">
                <FiRefreshCw className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Remove Duplicate Sales</h3>
                <p className="text-xs text-gray-600">Clean up duplicate sales records by Order ID</p>
              </div>
            </div>
            
            {/* Display last cleanup result if available */}
            {cleanupOperations['duplicate_sales']?.lastResult && (
              <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                <div className="text-gray-700 font-medium text-xs mb-1">
                  Last Cleanup: <span className="text-orange-600">{cleanupOperations['duplicate_sales'].lastResult.timestamp}</span>
                </div>
                <div className="text-gray-600 text-xs">
                  Removed <span className="font-semibold text-red-600">{cleanupOperations['duplicate_sales'].lastResult.duplicatesRemoved}</span> duplicates - 
                  <span className="font-semibold text-green-600"> {cleanupOperations['duplicate_sales'].lastResult.totalRemaining}</span> records remain
                </div>
              </div>
            )}
            
            <button
              onClick={() => handleDuplicateCleanup('sales')}
              disabled={cleanupOperations['duplicate_sales']?.isRunning}
              className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                cleanupOperations['duplicate_sales']?.isRunning
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white'
              }`}
            >
              {cleanupOperations['duplicate_sales']?.isRunning ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>{cleanupOperations['duplicate_sales']?.message || 'Removing duplicates...'}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <FiRefreshCw className="w-4 h-4" />
                  <span>Remove Duplicate Sales</span>
                </div>
              )}
            </button>
            
            {cleanupOperations['duplicate_sales']?.isRunning && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Progress</span>
                  <span>{cleanupOperations['duplicate_sales']?.progress || 0}%</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-orange-600 h-2 rounded-full progress-bar transition-all duration-300"
                    style={{ width: `${cleanupOperations['duplicate_sales']?.progress || 0}%` }}
                  ></div>
                </div>
                
                {/* Enhanced Progress Details */}
                <div className="grid grid-cols-3 gap-2 text-xs slide-up">
                  <div className="text-center p-2 bg-red-50 rounded border">
                    <div className="font-semibold text-red-600">{cleanupOperations['duplicate_sales']?.duplicatesRemoved || 0}</div>
                    <div className="text-gray-600">Removed</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded border">
                    <div className="font-semibold text-blue-600">{cleanupOperations['duplicate_sales']?.batchesProcessed || 0}</div>
                    <div className="text-gray-600">Batches</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded border">
                    <div className="font-semibold text-green-600">{cleanupOperations['duplicate_sales']?.totalRemaining || 0}</div>
                    <div className="text-gray-600">Remaining</div>
                  </div>
                </div>
                
                {cleanupOperations['duplicate_sales']?.logs?.length > 0 && (
                  <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                    {cleanupOperations['duplicate_sales'].logs[cleanupOperations['duplicate_sales'].logs.length - 1]}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>      {/* Product Data Actions Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="border-b border-gray-100 pb-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Product Data Actions</h2>
          <p className="text-sm text-gray-600">Manage and clean up your product data</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">          {/* Fix All Product Data (Remove Duplicates) */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-blue-500 rounded-xl shadow-sm">
                <FiSettings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Fix All Product Data</h3>
                <p className="text-xs text-gray-600">Remove duplicate products by TSIN ID</p>
              </div>
            </div>
            
            {/* Display last cleanup result if available */}
            {cleanupOperations['duplicate_products']?.lastResult && (
              <div className="bg-white/70 rounded-lg p-3 mb-4 border border-gray-200 shadow-sm">
                <div className="text-gray-700 font-medium text-xs mb-1">
                  Last Cleanup: <span className="text-blue-600">{cleanupOperations['duplicate_products'].lastResult.timestamp}</span>
                </div>
                <div className="text-gray-600 text-xs">
                  Removed <span className="font-semibold text-red-600">{cleanupOperations['duplicate_products'].lastResult.duplicatesRemoved}</span> duplicates - 
                  <span className="font-semibold text-green-600"> {cleanupOperations['duplicate_products'].lastResult.totalRemaining}</span> records remain
                </div>
              </div>
            )}
            
            <button
              onClick={() => handleDuplicateCleanup('products')}
              disabled={cleanupOperations['duplicate_products']?.isRunning}
              className={`w-full text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                cleanupOperations['duplicate_products']?.isRunning
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
              }`}
            >
              {cleanupOperations['duplicate_products']?.isRunning ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>{cleanupOperations['duplicate_products']?.message || 'Fixing products...'}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <FiSettings className="w-4 h-4" />
                  <span>Fix All Product Data</span>
                </div>
              )}
            </button>
            
            {cleanupOperations['duplicate_products']?.isRunning && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Progress</span>
                  <span>{cleanupOperations['duplicate_products']?.progress || 0}%</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full progress-bar transition-all duration-300"
                    style={{ width: `${cleanupOperations['duplicate_products']?.progress || 0}%` }}
                  ></div>
                </div>
                
                {/* Enhanced Progress Details */}
                <div className="grid grid-cols-3 gap-2 text-xs slide-up">
                  <div className="text-center p-2 bg-red-50 rounded border">
                    <div className="font-semibold text-red-600">{cleanupOperations['duplicate_products']?.duplicatesRemoved || 0}</div>
                    <div className="text-gray-600">Removed</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded border">
                    <div className="font-semibold text-orange-600">{cleanupOperations['duplicate_products']?.batchesProcessed || 0}</div>
                    <div className="text-gray-600">Batches</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded border">
                    <div className="font-semibold text-green-600">{cleanupOperations['duplicate_products']?.totalRemaining || 0}</div>
                    <div className="text-gray-600">Remaining</div>
                  </div>
                </div>
                
                {cleanupOperations['duplicate_products']?.logs?.length > 0 && (
                  <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                    {cleanupOperations['duplicate_products'].logs[cleanupOperations['duplicate_products'].logs.length - 1]}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delete All Products */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-red-500 rounded-xl shadow-sm">
                <FiTrash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Delete All Products</h3>
                <p className="text-xs text-gray-600">Remove all product records from database</p>
              </div>
            </div>
            
            <button
              onClick={async () => {
                if (!confirm('Are you sure you want to delete ALL product data? This action cannot be undone.')) {
                  return;
                }
                try {
                  const response = await fetch('/api/admin/takealot/delete-all-products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ integrationId })
                  });
                  const result = await response.json();
                  if (response.ok) {
                    showGeneralMessage('success', result.message || 'All products deleted successfully');
                  } else {
                    showGeneralMessage('error', `Failed to delete products: ${result.error}`);
                  }
                } catch (error: any) {
                  showGeneralMessage('error', `Error deleting products: ${error.message}`);
                }
              }}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Delete All Products
            </button>
          </div>
        </div>
      </div>      {/* API Call Logs Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">API Call Logs</h2>
            <p className="text-sm text-gray-600 mt-1">Track all fetch operations and their results</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Records per page selector */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Show:</label>
              <select
                value={logsPerPage}
                onChange={(e) => {
                  const newLogsPerPage = parseInt(e.target.value);
                  setLogsPerPage(newLogsPerPage);
                  setCurrentPage(1); // Reset to first page
                  loadApiLogs(1); // Reload logs with new page size
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">records</span>
            </div>
            
            <button
              onClick={() => loadApiLogs(currentPage)}
              disabled={isLoadingLogs}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50"
            >
              {isLoadingLogs ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Refreshing...</span>
                </div>
              ) : (
                <>
                  <FiRefreshCw className="w-4 h-4 mr-2 inline" />
                  Refresh Logs
                </>
              )}
            </button>
          </div>        </div>

        <div className="bg-gray-50 rounded-xl p-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white rounded-lg overflow-hidden shadow-sm">
              <thead>                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Timestamp</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Operation</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Type</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">API Response</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">DB Saved</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">DB Update</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Duration</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody>                {isLoadingLogs ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <p>Loading API logs...</p>
                      </div>
                    </td>
                  </tr>
                ) : apiLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center space-y-2">
                        <FiSettings className="w-8 h-8 text-gray-300" />
                        <p>No API calls recorded yet</p>
                        <p className="text-xs">Fetch operations will appear here</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  apiLogs.map((log, index) => (
                    <tr key={log.id || index} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-4 px-6 text-gray-600">
                        <div className="text-sm font-medium">
                          {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : 'N/A'}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-medium text-gray-900">{log.operation || 'Unknown Operation'}</div>
                        <div className="text-xs text-gray-500">{log.trigger || 'Manual Fetch'}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          log.type === 'sales' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {log.type === 'sales' ? 'Sales' : 'Products'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-emerald-700 font-medium">
                          {log.recordsFetched || log.totalRecords || 0} records
                        </div>
                        <div className="text-xs text-gray-500">
                          {log.pagesFetched || log.totalPages || 0} pages
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-emerald-700 font-medium">
                          {log.recordsSaved || log.recordsFetched || 0} saved
                        </div>
                        <div className="text-xs text-gray-500">
                          {log.duplicates || 0} duplicates
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-blue-700 font-medium">
                          {log.recordsUpdated || log.updatedRecords || 0} updated
                        </div>
                        <div className="text-xs text-gray-500">
                          {log.newRecords || (log.recordsSaved - (log.recordsUpdated || 0)) || 0} new
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-gray-700 font-medium">
                          {log.duration ? `${(log.duration / 1000).toFixed(2)}s` : 'N/A'}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          log.status === 'success' || log.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.status === 'error' || log.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {log.status === 'success' || log.status === 'completed' 
                            ? 'Success' 
                            : log.status === 'error' || log.status === 'failed'
                            ? 'Failed'
                            : 'Running'
                          }
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>        {/* Pagination */}
        {!isLoadingLogs && apiLogs.length > 0 && (
          <div className="flex items-center justify-between pt-6">
            <div className="text-sm text-gray-600">
              Showing {Math.min((currentPage - 1) * logsPerPage + 1, totalLogs)} - {Math.min(currentPage * logsPerPage, totalLogs)} of {totalLogs} API calls
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => loadApiLogs(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center space-x-1">
                {/* Show first page */}
                {currentPage > 3 && (
                  <>
                    <button 
                      onClick={() => loadApiLogs(1)}
                      className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      1
                    </button>
                    {currentPage > 4 && <span className="text-gray-400 text-sm px-2">...</span>}
                  </>
                )}
                
                {/* Show previous page */}
                {currentPage > 1 && (
                  <button 
                    onClick={() => loadApiLogs(currentPage - 1)}
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {currentPage - 1}
                  </button>
                )}
                
                {/* Current page */}
                <button className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm">
                  {currentPage}
                </button>
                
                {/* Show next page */}
                {currentPage < totalPages && (
                  <button 
                    onClick={() => loadApiLogs(currentPage + 1)}
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {currentPage + 1}
                  </button>
                )}
                
                {/* Show last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="text-gray-400 text-sm px-2">...</span>}
                    <button 
                      onClick={() => loadApiLogs(totalPages)}
                      className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              <button 
                onClick={() => loadApiLogs(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TakealotSettingsPage;