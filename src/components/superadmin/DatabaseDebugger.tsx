// src/components/superadmin/DatabaseDebugger.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useAuth } from '@/context/AuthContext';

export default function DatabaseDebugger() {
  const { currentUser, userProfile } = useAuth();
  const [debugData, setDebugData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    const debug: any = {};
    
    try {
      // Check current user info
      debug.currentUser = currentUser ? {
        uid: currentUser.uid,
        email: currentUser.email,
        emailVerified: currentUser.emailVerified
      } : null;
      
      debug.userProfile = userProfile;
      
      // Check if current user document exists
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        debug.currentUserDoc = {
          exists: userDocSnap.exists(),
          data: userDocSnap.exists() ? userDocSnap.data() : null
        };
      }
      
      // Try to get all users
      try {
        const usersRef = collection(db, 'users');
        const allUsersSnapshot = await getDocs(usersRef);
        debug.allUsers = {
          count: allUsersSnapshot.docs.length,
          users: allUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
          }))
        };
      } catch (error: any) {
        debug.allUsersError = {
          message: error.message,
          code: error.code
        };
      }
      
      // Check SuperAdmin users specifically
      try {
        const superAdminUsers = debug.allUsers?.users?.filter((user: any) => user.data.role === 'superadmin') || [];
        debug.superAdminUsers = {
          count: superAdminUsers.length,
          users: superAdminUsers
        };
      } catch (error: any) {
        debug.superAdminError = error.message;
      }
      
      // Check Admin users specifically
      try {
        const adminUsers = debug.allUsers?.users?.filter((user: any) => user.data.role === 'admin') || [];
        debug.adminUsers = {
          count: adminUsers.length,
          users: adminUsers
        };
      } catch (error: any) {
        debug.adminError = error.message;
      }
      
    } catch (error: any) {
      debug.error = {
        message: error.message,
        code: error.code,
        stack: error.stack
      };
    }
    
    setDebugData(debug);
    setLoading(false);
  };

  useEffect(() => {
    if (currentUser) {
      runDebug();
    }
  }, [currentUser]);

  if (loading) {
    return <div className="p-4 bg-gray-100 rounded">Loading debug data...</div>;
  }

  return (
    <div className="p-4 bg-gray-100 rounded space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Database Debug Info</h3>
        <button 
          onClick={runDebug}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>
      
      <pre className="text-xs bg-white p-3 rounded overflow-auto max-h-96">
        {JSON.stringify(debugData, null, 2)}
      </pre>
    </div>
  );
}
