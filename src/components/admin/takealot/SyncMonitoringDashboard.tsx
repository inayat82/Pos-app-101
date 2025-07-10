// src/components/admin/takealot/SyncMonitoringDashboard.tsx
// Real-time sync monitoring and performance metrics dashboard

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface SyncStatus {
  id: string;
  integrationId: string;
  type: 'products' | 'sales';
  strategy: 'legacy' | 'enhanced';
  status: 'running' | 'completed' | 'failed' | 'queued';
  startTime: Date;
  endTime?: Date;
  progress: {
    currentPage: number;
    totalPages: number;
    itemsProcessed: number;
    errorsCount: number;
  };
  metrics: {
    averagePageTime: number;
    concurrentPages: number;
    neonWrites: number;
    firebaseWrites: number;
  };
}

interface SyncMonitoringDashboardProps {
  integrationId: string;
}

export default function SyncMonitoringDashboard({ integrationId }: SyncMonitoringDashboardProps) {
  const { currentUser } = useAuth();
  const [activeSyncs, setActiveSyncs] = useState<SyncStatus[]>([]);
  const [recentSyncs, setRecentSyncs] = useState<SyncStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data for demonstration
  useEffect(() => {
    // Simulate loading sync status
    setTimeout(() => {
      setActiveSyncs([
        {
          id: 'sync-1',
          integrationId,
          type: 'products',
          strategy: 'enhanced',
          status: 'running',
          startTime: new Date(Date.now() - 120000), // 2 minutes ago
          progress: {
            currentPage: 7,
            totalPages: 15,
            itemsProcessed: 350,
            errorsCount: 2
          },
          metrics: {
            averagePageTime: 3500,
            concurrentPages: 3,
            neonWrites: 300,
            firebaseWrites: 50
          }
        }
      ]);

      setRecentSyncs([
        {
          id: 'sync-2',
          integrationId,
          type: 'sales',
          strategy: 'enhanced',
          status: 'completed',
          startTime: new Date(Date.now() - 300000), // 5 minutes ago
          endTime: new Date(Date.now() - 180000), // 3 minutes ago
          progress: {
            currentPage: 10,
            totalPages: 10,
            itemsProcessed: 500,
            errorsCount: 0
          },
          metrics: {
            averagePageTime: 2800,
            concurrentPages: 4,
            neonWrites: 500,
            firebaseWrites: 0
          }
        },
        {
          id: 'sync-3',
          integrationId,
          type: 'products',
          strategy: 'legacy',
          status: 'completed',
          startTime: new Date(Date.now() - 600000), // 10 minutes ago
          endTime: new Date(Date.now() - 420000), // 7 minutes ago
          progress: {
            currentPage: 8,
            totalPages: 8,
            itemsProcessed: 400,
            errorsCount: 5
          },
          metrics: {
            averagePageTime: 12000,
            concurrentPages: 1,
            neonWrites: 0,
            firebaseWrites: 400
          }
        }
      ]);

      setIsLoading(false);
    }, 1000);
  }, [integrationId]);

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date();
    const duration = Math.round((end.getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-blue-600 bg-blue-100';
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'queued':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Syncs */}
      {activeSyncs.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse mr-3"></div>
            Active Syncs
          </h2>
          <div className="space-y-4">
            {activeSyncs.map((sync) => (
              <div key={sync.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sync.status)}`}>
                      {sync.status.toUpperCase()}
                    </span>
                    <span className="font-medium">{sync.type.toUpperCase()}</span>
                    <span className="text-sm text-gray-500">({sync.strategy})</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDuration(sync.startTime)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Page {sync.progress.currentPage} of {sync.progress.totalPages}</span>
                    <span>{Math.round((sync.progress.currentPage / sync.progress.totalPages) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(sync.progress.currentPage / sync.progress.totalPages) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Items Processed:</span>
                    <div className="font-medium">{sync.progress.itemsProcessed}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Page Time:</span>
                    <div className="font-medium">{(sync.metrics.averagePageTime / 1000).toFixed(1)}s</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Concurrent Pages:</span>
                    <div className="font-medium">{sync.metrics.concurrentPages}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Errors:</span>
                    <div className={`font-medium ${sync.progress.errorsCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {sync.progress.errorsCount}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Avg Enhanced Sync Time</h3>
          <div className="text-2xl font-bold text-green-600">2.1 min</div>
          <div className="text-sm text-gray-500">vs 8.4 min legacy</div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Neon DB Success Rate</h3>
          <div className="text-2xl font-bold text-blue-600">98.5%</div>
          <div className="text-sm text-gray-500">1.5% fallback to Firebase</div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Concurrent Efficiency</h3>
          <div className="text-2xl font-bold text-purple-600">4.2x</div>
          <div className="text-sm text-gray-500">faster than sequential</div>
        </div>
      </div>

      {/* Recent Syncs */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Sync History</h2>
        <div className="space-y-3">
          {recentSyncs.map((sync) => (
            <div key={sync.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sync.status)}`}>
                  {sync.status.toUpperCase()}
                </span>
                <span className="font-medium">{sync.type.toUpperCase()}</span>
                <span className="text-sm text-gray-500">({sync.strategy})</span>
                <span className="text-sm text-gray-500">
                  {sync.progress.itemsProcessed} items
                </span>
              </div>
              <div className="text-right text-sm text-gray-500">
                <div>{formatDuration(sync.startTime, sync.endTime)}</div>
                <div className="text-xs">
                  {sync.endTime ? sync.endTime.toLocaleTimeString() : 'Running...'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
