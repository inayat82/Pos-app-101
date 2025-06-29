// src/components/superadmin/ClearLogsModal.tsx
'use client';

import { useState } from 'react';
import { Trash2, Clock, AlertTriangle, Users, Database } from 'lucide-react';

interface ClearLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearComplete: () => void;
}

interface LogStats {
  totalLogs: number;
  recentLogs: number;
  oldLogs: number;
  cutoffDate: string;
}

export default function ClearLogsModal({ isOpen, onClose, onClearComplete }: ClearLogsModalProps) {
  const [isClearing, setIsClearing] = useState(false);
  const [clearType, setClearType] = useState<'all' | 'old' | 'admin'>('old');
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Load statistics when modal opens
  useState(() => {
    if (isOpen && !logStats) {
      loadLogStats();
    }
  });

  const loadLogStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch('/api/superadmin/clear-cron-logs');
      if (response.ok) {
        const data = await response.json();
        setLogStats(data.statistics);
      }
    } catch (error) {
      console.error('Error loading log statistics:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm(`Are you sure you want to clear ${clearType === 'all' ? 'ALL' : clearType === 'old' ? 'old' : 'admin-specific'} logs? This action cannot be undone.`)) {
      return;
    }

    setIsClearing(true);
    try {
      const response = await fetch('/api/superadmin/clear-cron-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: clearType,
          adminId: clearType === 'admin' ? selectedAdminId : undefined
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully cleared ${result.deletedCount} logs`);
        onClearComplete();
        onClose();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      alert('Error clearing logs. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="text-red-500" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Clear Cron Job Logs</h2>
        </div>

        {/* Log Statistics */}
        {loadingStats ? (
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <p className="text-gray-600">Loading statistics...</p>
          </div>
        ) : logStats ? (
          <div className="mb-6 p-4 bg-gray-50 rounded space-y-2">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-blue-500" />
              <span className="text-sm">Total Logs: <strong>{logStats.totalLogs}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-green-500" />
              <span className="text-sm">Recent (7 days): <strong>{logStats.recentLogs}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-500" />
              <span className="text-sm">Old ({'>'}7 days): <strong>{logStats.oldLogs}</strong></span>
            </div>
          </div>
        ) : null}

        {/* Clear Options */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clear Options:
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="clearType"
                  value="old"
                  checked={clearType === 'old'}
                  onChange={(e) => setClearType(e.target.value as any)}
                  className="text-blue-600"
                />
                <Clock size={16} className="text-orange-500" />
                <span className="text-sm">Clear old logs ({'>'}7 days) - Recommended</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="clearType"
                  value="admin"
                  checked={clearType === 'admin'}
                  onChange={(e) => setClearType(e.target.value as any)}
                  className="text-blue-600"
                />
                <Users size={16} className="text-blue-500" />
                <span className="text-sm">Clear logs for specific admin</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="clearType"
                  value="all"
                  checked={clearType === 'all'}
                  onChange={(e) => setClearType(e.target.value as any)}
                  className="text-blue-600"
                />
                <Trash2 size={16} className="text-red-500" />
                <span className="text-sm">Clear ALL logs - Use with caution!</span>
              </label>
            </div>
          </div>

          {/* Admin ID Input */}
          {clearType === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin ID:
              </label>
              <input
                type="text"
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                placeholder="Enter admin ID"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-600" />
            <span className="text-sm text-yellow-800 font-medium">Warning</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            {clearType === 'all' 
              ? 'This will permanently delete ALL cron job logs from the database. This action cannot be undone.'
              : clearType === 'admin'
              ? 'This will permanently delete all logs for the specified admin. This action cannot be undone.'
              : 'This will delete logs older than 7 days to maintain database performance. Recent logs will be preserved.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isClearing}
            className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleClearLogs}
            disabled={isClearing || (clearType === 'admin' && !selectedAdminId)}
            className={`flex-1 px-4 py-2 rounded text-white disabled:opacity-50 ${
              clearType === 'all' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isClearing ? 'Clearing...' : `Clear ${clearType === 'old' ? 'Old' : clearType === 'all' ? 'All' : 'Admin'} Logs`}
          </button>
        </div>
      </div>
    </div>
  );
}
