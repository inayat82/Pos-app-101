import React, { useState, useEffect } from 'react';
import { FiX, FiLoader, FiUser, FiKey, FiTag } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { UserRole } from '@/types/user';

interface SubUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface TakealotIntegration {
  id: string;
  accountName: string;
  apiKey: string;
  assignedUserId: string;
  assignedUserName?: string;
  adminId: string;
}

interface AddTakealotAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editIntegration?: TakealotIntegration | null;
}

const AddTakealotAccountModal: React.FC<AddTakealotAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editIntegration = null,
}) => {
  const { currentUser } = useAuth();
  const [accountName, setAccountName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSubUsers, setIsLoadingSubUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editIntegration !== null;

  // Reset form when modal opens/closes or edit integration changes
  useEffect(() => {
    if (isOpen) {
      if (isEditing && editIntegration) {
        setAccountName(editIntegration.accountName);
        setApiKey(editIntegration.apiKey);
        setSelectedUserId(editIntegration.assignedUserId || '');
      } else {
        setAccountName('');
        setApiKey('');
        setSelectedUserId('');
      }
      setError(null);
      fetchSubUsers();
    }
  }, [isOpen, editIntegration, isEditing]);

  const fetchSubUsers = async () => {
    if (!currentUser?.uid) return;

    try {
      setIsLoadingSubUsers(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('adminId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      
      const subUsersList: SubUser[] = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.role === UserRole.TakealotUser || userData.role === UserRole.POSUser) {
          subUsersList.push({
            id: doc.id,
            name: userData.displayName || userData.email,
            email: userData.email,
            role: userData.role,
          });
        }
      });
      
      setSubUsers(subUsersList);
    } catch (err: any) {
      console.error('Error fetching sub-users:', err);
    } finally {
      setIsLoadingSubUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const integrationData = {
        accountName: accountName.trim(),
        apiKey: apiKey.trim(),
        assignedUserId: selectedUserId || currentUser.uid,
        assignedUserName: selectedUserId ? 
          subUsers.find(user => user.id === selectedUserId)?.name || 'Unknown User' : 
          'Admin',
        adminId: currentUser.uid,
        updatedAt: Timestamp.now(),
      };

      if (isEditing && editIntegration) {
        // Update existing integration
        await updateDoc(doc(db, 'takealotIntegrations', editIntegration.id), integrationData);
      } else {
        // Create new integration
        await addDoc(collection(db, 'takealotIntegrations'), {
          ...integrationData,
          createdAt: Timestamp.now(),
        });
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error saving integration:', err);
      setError('Failed to save integration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Takealot Integration' : 'Add Takealot Integration'}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Account Name */}
          <div>
            <label htmlFor="accountName" className="block text-sm font-medium text-gray-700 mb-2">
              <FiTag className="inline mr-2" />
              Account Name
            </label>
            <input
              type="text"
              id="accountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Main Store, Electronics Division"
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              A friendly name to identify this Takealot account
            </p>
          </div>

          {/* API Key */}
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              <FiKey className="inline mr-2" />
              API Key
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your Takealot API key"
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              Your Takealot API key (kept secure and encrypted)
            </p>
          </div>

          {/* User Assignment */}
          <div>
            <label htmlFor="assignedUser" className="block text-sm font-medium text-gray-700 mb-2">
              <FiUser className="inline mr-2" />
              Assign Access To
            </label>
            <select
              id="assignedUser"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting || isLoadingSubUsers}
            >
              <option value="">Admin (You)</option>
              {subUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {isLoadingSubUsers ? 'Loading users...' : 
               subUsers.length === 0 ? 'No sub-users found. Only admin access will be available.' :
               'Select a user to grant access to this integration, or leave as Admin'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Integration' : 'Create Integration'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTakealotAccountModal;
