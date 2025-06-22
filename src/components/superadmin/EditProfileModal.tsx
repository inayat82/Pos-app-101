// src/components/superadmin/EditProfileModal.tsx
"use client";
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { User, updateProfile } from 'firebase/auth'; // For updating Firebase Auth profile
// import { doc, updateDoc } from 'firebase/firestore'; // If you store profile data in Firestore
// import { db } from '@/lib/firebase/firebase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null; // Firebase User object
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, user }) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(''); // Email is usually not directly updatable this way, more complex flow
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { currentUser } = useContext(AuthContext) ?? {};

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError("No user logged in.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Update Firebase Auth profile
      await updateProfile(currentUser, { displayName });
      
      // If you also store profile info in Firestore, update it here
      // const userDocRef = doc(db, 'users', currentUser.uid); // Example path
      // await updateDoc(userDocRef, { displayName });

      setSuccessMessage("Profile updated successfully!");
      // Optionally, refresh user data in AuthContext or trigger a re-fetch
      // onClose(); // Close modal on success after a delay or immediately
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 2000);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError(err.message || "Failed to update profile.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Edit Profile</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">{error}</div>}
        {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md">{successMessage}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input 
              type="text" 
              id="displayName" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input 
              type="email" 
              id="email" 
              value={email}
              // onChange={(e) => setEmail(e.target.value)} // Email change is complex, often requires re-authentication or verification
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
              disabled // Email is typically not changed directly here for security reasons
              title="Email address cannot be changed here."
            />
            <p className="text-xs text-gray-500 mt-1">Email address cannot be changed directly. Please contact support for assistance.</p>
          </div>

          <div className="flex justify-end space-x-3">
            <button 
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
