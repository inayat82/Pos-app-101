'use client';

import React, { useState, useEffect } from 'react';
import { FiAlertCircle, FiTruck } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import POSLayout from '@/components/admin/POSLayout';

const SupplierPage = () => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen flex flex-col items-center justify-center">
        <FiAlertCircle className="text-red-500 text-6xl mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Authentication Required</h2>
        <p className="text-gray-600">Please log in to manage suppliers.</p>
      </div>
    );
  }

  return (
    <POSLayout
      pageTitle="Supplier Management"
      pageDescription="Manage supplier information and contact details for your business."
      breadcrumbs={[
        { label: 'POS System' },
        { label: 'Supplier Management' }
      ]}
    >
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <FiTruck className="text-blue-600 text-xl mr-3" />
            <div>
              <div className="text-sm text-slate-600">Supplier Management</div>
              <div className="text-2xl font-bold text-slate-900">Coming Soon</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-slate-200">
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 mx-auto">
            <FiTruck className="text-4xl text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-3">Supplier Management</h3>
          <p className="text-lg text-slate-600 mb-6 max-w-md mx-auto">
            Supplier management functionality is being updated. Please check back soon.
          </p>
        </div>
      </div>
    </POSLayout>
  );
};

export default SupplierPage;
