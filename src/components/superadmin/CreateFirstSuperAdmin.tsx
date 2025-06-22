// src/components/superadmin/CreateFirstSuperAdmin.tsx
"use client";
import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { FiUser, FiMail, FiSave, FiCheck } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';

export default function CreateFirstSuperAdmin() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Pre-fill with the manually created SuperAdmin email
  const superAdminEmail = 'admin@wootech.co.za';
  const displayName = 'Super Administrator';

  const handleCreateProfile = async () => {
    if (!currentUser) {
      setError('No authenticated user found. Please log in first.');
      return;
    }

    if (currentUser.email !== superAdminEmail) {
      setError(`Please log in with the SuperAdmin account: ${superAdminEmail}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create/update user profile in Firestore for the current authenticated user
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: displayName,
        role: 'superadmin',
        isActive: true,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        emailVerified: currentUser.emailVerified
      });

      setSuccess(true);
      console.log('SuperAdmin profile created successfully for UID:', currentUser.uid);
      
      // Refresh the page after a delay to show the updated UI
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Error creating SuperAdmin profile:', error);
      setError(error.message || 'Failed to create SuperAdmin profile');
    } finally {
      setLoading(false);
    }
  };
  if (success) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center mb-4">
          <FiCheck className="text-green-600 mr-2" />
          <h2 className="text-xl font-semibold text-green-800">SuperAdmin Profile Created!</h2>
        </div>
        <p className="text-green-700">Your SuperAdmin profile has been set up successfully. The page will refresh automatically.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white border border-gray-200 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Setup SuperAdmin Profile</h2>
      <p className="text-gray-600 mb-6 text-center">
        Complete your SuperAdmin profile setup to access the user management system.
      </p>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <div className="relative">
            <FiUser className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={displayName}
              readOnly
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <div className="relative">
            <FiMail className="absolute left-3 top-3 text-gray-400" />
            <input
              type="email"
              value={superAdminEmail}
              readOnly
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
        </div>

        {currentUser && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-700 text-sm">
              <strong>Current User:</strong> {currentUser.email}
            </p>
            <p className="text-blue-700 text-xs mt-1">
              Verified: {currentUser.emailVerified ? 'Yes' : 'No'}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleCreateProfile}
        disabled={loading || !currentUser}
        className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        ) : (
          <>
            <FiSave className="mr-2" />
            Create SuperAdmin Profile
          </>
        )}
      </button>

      {!currentUser && (
        <p className="text-center text-sm text-gray-500 mt-4">
          Please log in with {superAdminEmail} first
        </p>
      )}
    </div>
  );
}
