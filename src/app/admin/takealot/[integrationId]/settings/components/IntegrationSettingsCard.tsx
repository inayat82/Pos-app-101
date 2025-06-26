'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiSave, FiTrash2, FiSettings, FiUser, FiKey, FiTag
} from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/firebase';
import { 
  doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, 
  serverTimestamp
} from 'firebase/firestore';
import { UserRole } from '@/types/user';
import { 
  validateIntegrationForm, 
  sanitizeIntegrationData, 
  getAssignedUserName,
  formatUserDisplayName 
} from '../utils/integrationUtils';

interface IntegrationSettingsCardProps {
  integrationId: string;
  currentUser: any;
  showMessage: (type: 'success' | 'error', message: string) => void;
  onIntegrationUpdate?: (updatedData: any) => void;
  onIntegrationDelete?: () => void;
}

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

const IntegrationSettingsCard: React.FC<IntegrationSettingsCardProps> = ({
  integrationId,
  currentUser,
  showMessage,
  onIntegrationUpdate,
  onIntegrationDelete
}) => {
  const router = useRouter();

  // State for integration data
  const [integration, setIntegration] = useState<TakealotIntegration | null>(null);
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [accountName, setAccountName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Fetch integration data
  const fetchIntegration = useCallback(async () => {
    if (!currentUser?.uid || !integrationId) {
      return;
    }
    setIsLoading(true);
    try {
      const integrationDocRef = doc(db, 'takealotIntegrations', integrationId);
      const integrationDocSnap = await getDoc(integrationDocRef);
      
      if (!integrationDocSnap.exists()) {
        showMessage('error', 'Integration not found.');
        setIntegration(null); 
        return;
      }
      
      const integrationData = integrationDocSnap.data() as TakealotIntegration;
      
      if (integrationData.adminId !== currentUser.uid && integrationData.assignedUserId !== currentUser.uid) {
        showMessage('error', 'Access denied to this integration.');
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
      showMessage('error', `Failed to load integration: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.uid, integrationId, showMessage]);

  // Fetch sub-users
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
      showMessage('error', `Failed to load sub-users: ${err.message}`);
      setSubUsers([]); 
    }
  }, [currentUser?.uid, showMessage]);

  // Load data on component mount
  useEffect(() => {
    if (currentUser?.uid && integrationId) {
      Promise.all([
        fetchIntegration(),
        fetchSubUsers()
      ]);
    }
  }, [currentUser?.uid, integrationId, fetchIntegration, fetchSubUsers]);

  // Handle save form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!integration || !currentUser?.uid || !integration.id) {
      showMessage('error', 'Cannot save: Integration data, user session, or Integration ID is missing.');
      return;
    }

    // Validate form data
    const validation = validateIntegrationForm(accountName, apiKey, assignedUserId, currentUser.uid);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      showMessage('error', 'Please fix the validation errors below.');
      return;
    }

    // Clear validation errors
    setValidationErrors({});
    setIsSaving(true);

    try {
      // Sanitize form data
      const sanitizedData = sanitizeIntegrationData({
        accountName,
        apiKey,
        assignedUserId
      });

      const assignedUserName = getAssignedUserName(
        sanitizedData.assignedUserId,
        currentUser.uid,
        subUsers
      );

      const updateData: Partial<TakealotIntegration> = {
        accountName: sanitizedData.accountName,
        apiKey: sanitizedData.apiKey,
        assignedUserId: sanitizedData.assignedUserId,
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
        updatedAt: new Date()
      };
      setIntegration(prev => prev ? { ...prev, ...updatedIntegrationFields } : null);

      showMessage('success', 'Integration updated successfully!');
      
      // Call callback if provided
      if (onIntegrationUpdate) {
        onIntegrationUpdate(updatedIntegrationFields);
      }

    } catch (err: any) {
      console.error('Error updating integration:', err);
      showMessage('error', `Failed to update integration: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete integration
  const handleDelete = async () => {
    if (!integration || !integration.id) {
      showMessage('error', 'Cannot delete: Integration data or ID is missing.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete the integration "${integration.accountName}"? This action cannot be undone and will remove all associated data.`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const integrationRef = doc(db, 'takealotIntegrations', integration.id);
      await deleteDoc(integrationRef);
      
      showMessage('success', 'Integration deleted successfully. Redirecting...');
      
      // Call callback if provided
      if (onIntegrationDelete) {
        onIntegrationDelete();
      }
      
      setTimeout(() => {
        router.push('/admin/integration'); 
      }, 1500);

    } catch (err: any) {
      console.error('Error deleting integration:', err);
      showMessage('error', `Failed to delete integration: ${err.message}`);
      setIsDeleting(false); 
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 ease-in-out">
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="text-gray-600 font-medium">Loading integration settings...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 shadow-lg p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <FiSettings className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="text-lg font-medium text-red-800 mb-2">Integration Not Found</h3>
              <p className="text-red-600">The requested integration could not be found or you don't have access to it.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 ease-in-out">
      <div className="border-b border-gray-100 pb-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-md">
              <FiSettings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Integration Settings</h2>
              <p className="text-sm text-gray-500">Configure your Takealot API integration settings.</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border border-emerald-200">
              Enhanced
            </span>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
            >
              <FiTrash2 className="w-4 h-4 mr-2 inline" />
              {isDeleting ? 'Deleting...' : 'Delete Integration'}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Account Name Field */}
        <div className="space-y-3">
          <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700">
            <FiTag className="w-4 h-4 text-emerald-600" />
            <span>Account Name</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={accountName}
              onChange={(e) => {
                setAccountName(e.target.value);
                if (validationErrors.accountName) {
                  setValidationErrors(prev => ({ ...prev, accountName: '' }));
                }
              }}
              className={`w-full px-4 py-3 pl-11 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md bg-gray-50 focus:bg-white ${
                validationErrors.accountName 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-500'
              }`}
              placeholder="Enter your Takealot account name"
              required
            />
            <FiTag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
          {validationErrors.accountName && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.accountName}</p>
          )}
        </div>

        {/* API Key Field */}
        <div className="space-y-3">
          <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700">
            <FiKey className="w-4 h-4 text-emerald-600" />
            <span>API Key</span>
          </label>
          <div className="relative">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                if (validationErrors.apiKey) {
                  setValidationErrors(prev => ({ ...prev, apiKey: '' }));
                }
              }}
              className={`w-full px-4 py-3 pl-11 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md bg-gray-50 focus:bg-white ${
                validationErrors.apiKey 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-500'
              }`}
              placeholder="Enter your Takealot API key"
              required
            />
            <FiKey className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
          {validationErrors.apiKey && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.apiKey}</p>
          )}
        </div>

        {/* Assigned User Field */}
        <div className="space-y-3">
          <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700">
            <FiUser className="w-4 h-4 text-emerald-600" />
            <span>Assigned User</span>
          </label>
          <div className="relative">
            <select
              value={assignedUserId}
              onChange={(e) => {
                setAssignedUserId(e.target.value);
                if (validationErrors.assignedUserId) {
                  setValidationErrors(prev => ({ ...prev, assignedUserId: '' }));
                }
              }}
              className={`w-full px-4 py-3 pl-11 border rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md bg-gray-50 focus:bg-white appearance-none ${
                validationErrors.assignedUserId 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-500'
              }`}
            >
              <option value={currentUser.uid}>
                {formatUserDisplayName({ name: '', email: '', role: '' }, true)}
              </option>
              {subUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {formatUserDisplayName(user)}
                </option>
              ))}
            </select>
            <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          {validationErrors.assignedUserId && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.assignedUserId}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full px-6 py-4 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {isSaving ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving Changes...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <FiSave className="w-5 h-5" />
                <span>Save Changes</span>
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default IntegrationSettingsCard;
