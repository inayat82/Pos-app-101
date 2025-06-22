// src/app/admin/takealot/[integrationId]/logs/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiRefreshCw, FiActivity, FiClock, FiDatabase, FiArrowLeft
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/firebase';
import { 
  collection, query, where, getDocs, orderBy, limit, Timestamp, startAfter
} from 'firebase/firestore';
import type { FirebaseJobLog, JobLogUI } from '@/types/job';
import EnhancedJobStatusLogsCard2 from '../../../../../components/admin/EnhancedJobStatusLogsCard2';

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

interface LogsPageProps {
  params: Promise<{ integrationId: string }>;
}

const LogsPage: React.FC<LogsPageProps> = ({ params }) => {
  const [integrationId, setIntegrationId] = useState<string>('');
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  const router = useRouter();

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setIntegrationId(resolvedParams.integrationId);
    };
    resolveParams();
  }, [params]);

  // State
  const [integration, setIntegration] = useState<TakealotIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [runningJobs, setRunningJobs] = useState<JobLogUI[]>([]);
  const [completedJobs, setCompletedJobs] = useState<JobLogUI[]>([]);
  const [activeJobView, setActiveJobView] = useState<'running' | 'history'>('running');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Pagination state
  const [currentHistoryPage, setCurrentHistoryPage] = useState(1);
  const [totalHistoryPages, setTotalHistoryPages] = useState(1);
  const [historyPageSize] = useState(10);

  // Load integration data
  useEffect(() => {
    const loadIntegration = async () => {
      if (!currentUser || !integrationId) return;

      try {
        setIsLoading(true);
        const integrationDoc = await getDocs(
          query(
            collection(db, 'takealotIntegrations'),
            where('adminId', '==', currentUser.uid),
            where('__name__', '==', integrationId)
          )
        );

        if (!integrationDoc.empty) {
          const docData = integrationDoc.docs[0].data();
          const integrationData: TakealotIntegration = {
            id: integrationDoc.docs[0].id,
            ...docData,
          } as TakealotIntegration;
          setIntegration(integrationData);
          setPageTitle(`Job Logs - ${integrationData.accountName}`);
        } else {
          console.error('Integration not found');
          router.push('/admin/dashboard');
        }
      } catch (error) {
        console.error('Error loading integration:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadIntegration();
  }, [currentUser, integrationId, router, setPageTitle]);

  // Load running jobs
  const loadRunningJobs = useCallback(async () => {
    if (!currentUser) return;

    try {
      const runningQuery = query(
        collection(db, 'takealotJobLogs'),
        where('userId', '==', currentUser.uid),
        where('status', 'in', ['running', 'queued']),
        orderBy('startTime', 'desc'),
        limit(20)
      );

      const runningSnapshot = await getDocs(runningQuery);
      const running: JobLogUI[] = runningSnapshot.docs.map(doc => {
        const data = doc.data() as FirebaseJobLog;
        return {
          ...data,
          isLoading: data.status === 'running' || data.status === 'queued'
        };
      });

      setRunningJobs(running);
    } catch (error) {
      console.error('Error loading running jobs:', error);
    }
  }, [currentUser]);

  // Load completed jobs with pagination
  const loadCompletedJobs = useCallback(async (page: number = 1) => {
    if (!currentUser) return;

    try {
      setIsLoadingHistory(true);
      
      // Calculate offset for pagination
      const offset = (page - 1) * historyPageSize;
      
      // Get total count for pagination
      const totalQuery = query(
        collection(db, 'takealotJobLogs'),
        where('userId', '==', currentUser.uid),
        where('status', 'in', ['completed', 'success', 'failed', 'error'])
      );
      const totalSnapshot = await getDocs(totalQuery);
      const totalCount = totalSnapshot.docs.length;
      setTotalHistoryPages(Math.ceil(totalCount / historyPageSize));

      // Get paginated results
      let completedQuery = query(
        collection(db, 'takealotJobLogs'),
        where('userId', '==', currentUser.uid),
        where('status', 'in', ['completed', 'success', 'failed', 'error']),
        orderBy('startTime', 'desc'),
        limit(historyPageSize)
      );

      // If not first page, add startAfter for pagination
      if (page > 1 && offset > 0) {
        // Get the document to start after
        const previousQuery = query(
          collection(db, 'takealotJobLogs'),
          where('userId', '==', currentUser.uid),
          where('status', 'in', ['completed', 'success', 'failed', 'error']),
          orderBy('startTime', 'desc'),
          limit(offset)
        );
        const previousSnapshot = await getDocs(previousQuery);
        if (previousSnapshot.docs.length > 0) {
          const lastDoc = previousSnapshot.docs[previousSnapshot.docs.length - 1];
          completedQuery = query(completedQuery, startAfter(lastDoc));
        }
      }

      const completedSnapshot = await getDocs(completedQuery);
      const completed: JobLogUI[] = completedSnapshot.docs.map(doc => {
        const data = doc.data() as FirebaseJobLog;
        return {
          ...data,
          isLoading: false
        };
      });

      setCompletedJobs(completed);
      setCurrentHistoryPage(page);
    } catch (error) {
      console.error('Error loading completed jobs:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [currentUser, historyPageSize]);

  // Auto-refresh running jobs
  useEffect(() => {
    loadRunningJobs();
    const interval = setInterval(loadRunningJobs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [loadRunningJobs]);

  // Load initial completed jobs
  useEffect(() => {
    if (activeJobView === 'history') {
      loadCompletedJobs(1);
    }
  }, [activeJobView, loadCompletedJobs]);

  // Handle pagination
  const handleLoadHistoryPage = (page: number) => {
    loadCompletedJobs(page);
  };

  // Refresh functions
  const handleRefreshRunning = () => {
    loadRunningJobs();
  };

  const handleRefreshHistory = () => {
    loadCompletedJobs(currentHistoryPage);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job logs...</p>
        </div>
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Integration not found</p>
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/admin/takealot/${integrationId}/settings`)}
                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiArrowLeft className="w-4 h-4 mr-2" />
                Back to Settings
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Job Logs</h1>
                <p className="text-gray-600 mt-1">
                  {integration.accountName} - Real-time job monitoring and history
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={activeJobView === 'running' ? handleRefreshRunning : handleRefreshHistory}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                disabled={isLoadingHistory}
              >
                <FiRefreshCw className={`w-4 h-4 mr-2 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiActivity className="h-8 w-8 text-blue-500" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Running Jobs</div>
                <div className="text-2xl font-semibold text-gray-900">{runningJobs.length}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiDatabase className="h-8 w-8 text-green-500" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Completed Jobs</div>
                <div className="text-2xl font-semibold text-gray-900">{completedJobs.length}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiClock className="h-8 w-8 text-orange-500" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Total Records</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {[...runningJobs, ...completedJobs].reduce((sum, job) => 
                    sum + (job.totalRecordsFetched || job.successfulItems || 0), 0
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiDatabase className="h-8 w-8 text-purple-500" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Success Rate</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {(() => {
                    const allJobs = [...runningJobs, ...completedJobs];
                    const successfulJobs = allJobs.filter(job => 
                      job.status === 'success' || job.status === 'completed'
                    ).length;
                    return allJobs.length > 0 ? Math.round((successfulJobs / allJobs.length) * 100) : 0;
                  })()}%
                </div>
              </div>
            </div>
          </div>
        </div>        {/* Enhanced Job Logs */}
        <EnhancedJobStatusLogsCard2
          runningJobs={runningJobs}
          completedJobs={completedJobs}
          activeJobView={activeJobView}
          setActiveJobView={setActiveJobView}
          isLoadingHistory={isLoadingHistory}
          currentHistoryPage={currentHistoryPage}
          totalHistoryPages={totalHistoryPages}
          onLoadHistoryPage={handleLoadHistoryPage}
        />
      </div>
    </div>
  );
};

export default LogsPage;
