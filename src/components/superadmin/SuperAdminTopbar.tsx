// src/components/superadmin/SuperAdminTopbar.tsx
"use client";
import React, { useState, useContext } from 'react';
import { AuthContext, AuthContextType } from '@/context/AuthContext'; // Import AuthContextType
import { useRouter } from 'next/navigation';
import EditProfileModal from './EditProfileModal'; 
import { BuildingStorefrontIcon, UserCircleIcon, CogIcon as CogIconSolid, ArrowRightOnRectangleIcon as LogoutIconSolid } from '@heroicons/react/20/solid';

const SuperAdminTopbar = () => {
  const authContext = useContext<AuthContextType | undefined>(AuthContext);
  const router = useRouter();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  const currentUser = authContext?.currentUser;
  const userProfile = authContext?.userProfile; // Keep this to get the name if available
  const logout = authContext?.logout;
  // Prioritize name from userProfile, then displayName from Firebase user, then part of email
  const displayName = userProfile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  const handleLogout = async () => {
    if (logout) {
      try {
        await logout();
        router.push('/auth/login');
      } catch (error) {
        console.error("Failed to logout:", error);
      }
    }
  };

  return (
    <header className="bg-white shadow-md h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center">
        <BuildingStorefrontIcon className="h-7 w-7 text-indigo-600 mr-2" />
        <h1 className="text-xl font-semibold text-gray-800 hidden sm:block">Inventory Hub</h1>
      </div>

      <div className="relative">
        {currentUser && (
          <button 
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            aria-expanded={isProfileDropdownOpen}
            aria-haspopup="true"
          >
            <UserCircleIcon className="h-8 w-8 text-gray-500" /> 
            <div className="hidden md:flex flex-col items-start text-sm">
              <span className="font-medium text-gray-700">{displayName}</span>
              <span className="text-xs text-gray-500">{userProfile?.role || 'SuperAdmin'}</span>
            </div>
             <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 hidden md:block ${isProfileDropdownOpen ? 'transform rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          </button>
        )}
        {isProfileDropdownOpen && currentUser && (
          <div 
            className="absolute right-0 mt-2 w-60 bg-white rounded-lg shadow-xl z-40 py-1 border border-gray-200 origin-top-right"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="user-menu-button"
          >
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
              <p className="text-xs text-gray-500 mt-0.5">Role: {userProfile?.role || 'SuperAdmin'}</p>
            </div>
            <div className="py-1" role="none">
              <button
                onClick={() => {
                  setIsEditProfileModalOpen(true);
                  setIsProfileDropdownOpen(false);
                }}
                className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
                role="menuitem"
              >
                <CogIconSolid className="h-5 w-5 mr-2 text-gray-500" aria-hidden="true" />
                Edit Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors duration-150"
                role="menuitem"
              >
                <LogoutIconSolid className="h-5 w-5 mr-2 text-red-500" aria-hidden="true" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
      {/* EditProfileModal is expected to fetch its own user data or use context if needed, or only take basic user identifier */}
      {isEditProfileModalOpen && currentUser && (
        <EditProfileModal 
          isOpen={isEditProfileModalOpen} 
          onClose={() => setIsEditProfileModalOpen(false)} 
          user={currentUser} // Pass the Firebase User object
          // Removed userProfile prop as it caused an error; EditProfileModal should handle fetching/managing profile data if needed beyond basic user info
        />
      )}
    </header>
  );
};

export default SuperAdminTopbar;
