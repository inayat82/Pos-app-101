// src/app/admin/integration/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiSettings, FiUsers, FiTrash2, FiEdit3, FiEye } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import AddTakealotAccountModal from '@/components/admin/AddTakealotAccountModal';

interface TakealotIntegration {
  id: string;
  accountName: string;
  apiKey: string;
  assignedUserId: string;
  assignedUserName?: string;
  createdAt: any;
  updatedAt: any;
  adminId: string;
  isActive?: boolean;
}

const IntegrationPage = () => {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  const [integrations, setIntegrations] = useState<TakealotIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<TakealotIntegration | null>(null);

  // Set page title
  useEffect(() => {
    setPageTitle('Integration Management');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Fetch integrations
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    fetchIntegrations();
  }, [currentUser?.uid]);
  const fetchIntegrations = async () => {
    if (!currentUser?.uid) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching integrations for admin:', currentUser.uid);
      
      const integrationsRef = collection(db, 'takealotIntegrations');
      const q = query(
        integrationsRef, 
        where('adminId', '==', currentUser.uid)
        // Removed orderBy to avoid index issues
      );
      
      const querySnapshot = await getDocs(q);
      const integrationsList: TakealotIntegration[] = [];
      
      console.log('Query result size:', querySnapshot.size);
      
      querySnapshot.forEach((doc) => {
        console.log('Integration found:', doc.id, doc.data());
        integrationsList.push({
          id: doc.id,
          ...doc.data()
        } as TakealotIntegration);
      });
      
      // Sort by createdAt on client side
      integrationsList.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime();
      });
      
      console.log('Final integrations list:', integrationsList);
      setIntegrations(integrationsList);
    } catch (err: any) {
      console.error('Error fetching integrations:', err);
      setError(`Failed to fetch integrations: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this integration? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'takealotIntegrations', integrationId));
      setIntegrations(prev => prev.filter(integration => integration.id !== integrationId));
    } catch (err: any) {
      console.error('Error deleting integration:', err);
      setError('Failed to delete integration');
    }
  };
  const handleIntegrationAdded = () => {
    fetchIntegrations();
    setIsAddModalOpen(false);
  };

  // Debug function to test Firestore connection
  const testFirestoreConnection = async () => {
    try {
      console.log('Testing Firestore connection...');
      console.log('Current user:', currentUser);
      
      const integrationsRef = collection(db, 'takealotIntegrations');
      const allQuery = query(integrationsRef);
      const allSnapshot = await getDocs(allQuery);
      
      console.log('All integrations in database:', allSnapshot.size);
      allSnapshot.forEach((doc) => {
        console.log('Doc:', doc.id, doc.data());
      });
      
      if (currentUser?.uid) {
        const userQuery = query(integrationsRef, where('adminId', '==', currentUser.uid));
        const userSnapshot = await getDocs(userQuery);
        console.log('User integrations:', userSnapshot.size);
        userSnapshot.forEach((doc) => {
          console.log('User doc:', doc.id, doc.data());
        });
      }
    } catch (error) {
      console.error('Firestore test error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Takealot Integrations</h1>
          <p className="text-gray-600 mt-1">
            Manage your Takealot store integrations and assign access to team members
          </p>
        </div>        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="mr-2" />
          Add Integration
        </button>
        
        {/* Debug button - remove in production */}
        <button
          onClick={testFirestoreConnection}
          className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <FiEye className="mr-2" />
          Debug Firestore
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Integrations Grid */}
      {integrations.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FiSettings className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Integrations Yet</h3>
          <p className="text-gray-500 mb-6">
            Get started by adding your first Takealot store integration
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiPlus className="mr-2" />
            Add Your First Integration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              {/* Integration Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {integration.accountName}
                  </h3>
                  <div className="flex items-center text-sm text-gray-500">
                    <FiUsers className="mr-1" />
                    {integration.assignedUserName || 'Admin Access'}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedIntegration(integration);
                      setIsAddModalOpen(true);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Integration"
                  >
                    <FiEdit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteIntegration(integration.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Integration"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Integration Details */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    API Key
                  </label>
                  <div className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                    {integration.apiKey.substring(0, 8)}...
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </label>
                  <div className="mt-1 text-sm text-gray-900">
                    {integration.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                  </div>
                </div>
              </div>

              {/* Quick Access Links */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex space-x-2">
                  <a
                    href={`/admin/takealot/${integration.id}/products`}
                    className="flex-1 text-center px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Products
                  </a>
                  <a
                    href={`/admin/takealot/${integration.id}/sales`}
                    className="flex-1 text-center px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    Sales
                  </a>
                  <a
                    href={`/admin/takealot/${integration.id}/settings`}
                    className="flex-1 text-center px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Settings
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Integration Modal */}
      {isAddModalOpen && (
        <AddTakealotAccountModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setSelectedIntegration(null);
          }}
          onSuccess={handleIntegrationAdded}
          editIntegration={selectedIntegration}
        />
      )}
    </div>
  );
};

export default IntegrationPage;