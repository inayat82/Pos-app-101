// src/components/superadmin/SuperAdminSidebar.tsx
"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthContext, AuthContextType } from '@/context/AuthContext'; // Import AuthContextType
import { useRouter } from 'next/navigation';
import {
  HomeIcon,
  UsersIcon,
  CogIcon,
  GlobeAltIcon,
  CodeBracketSquareIcon,
  AdjustmentsHorizontalIcon,
  ArrowLeftOnRectangleIcon,
  BuildingStorefrontIcon 
} from '@heroicons/react/24/outline';

const SuperAdminSidebar = () => {
  const currentPathname = usePathname(); // Renamed for clarity
  const router = useRouter();
  const authContext = React.useContext<AuthContextType | undefined>(AuthContext);

  const logout = authContext?.logout;
  const currentUser = authContext?.currentUser;

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

  const menuItems = [
    { name: 'Dashboard', href: '/superadmin/dashboard', icon: HomeIcon },
    { name: 'User Management', href: '/superadmin/user-management', icon: UsersIcon },
    { name: 'Firebase Config', href: '/superadmin/firebase-config', icon: CogIcon },
    { name: 'Webshare Proxy', href: '/superadmin/webshare-proxy', icon: GlobeAltIcon },
    { name: 'Zyte API', href: '/superadmin/zyte-api', icon: CodeBracketSquareIcon },
    { name: 'App Settings', href: '/superadmin/app-settings', icon: AdjustmentsHorizontalIcon },
  ];

  return (
    <div className="flex flex-col h-full w-64 bg-slate-800 text-slate-100 shadow-lg">
      {/* Logo Area */}
      <div className="flex items-center justify-center h-20 border-b border-slate-700">
        <Link href="/superadmin/dashboard" className="flex items-center space-x-2 text-xl font-semibold text-white">
          <BuildingStorefrontIcon className="h-8 w-8 text-indigo-400" />
          <span>Inventory Hub</span>
        </Link>
        {/* Or use an Image component:
        <Link href="/superadmin/dashboard">
          <Image src="/logo.png" alt="Inventory Hub Logo" width={150} height={40} />
        </Link>
        */}
      </div>
      
      <nav className="flex-grow mt-4 space-y-1 px-2">
        {menuItems.map((item) => {
          const isActive = currentPathname === item.href || 
                           (currentPathname?.startsWith(item.href) && item.href !== '/superadmin/dashboard');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-lg transition-colors duration-150 ease-in-out group
                ${isActive 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`} />
              <span className="ml-3 text-sm font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="px-4 py-4 mt-auto border-t border-slate-700">
        {currentUser && (
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-600 hover:text-white transition-colors duration-150 ease-in-out group"
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5 text-slate-400 group-hover:text-white" />
            <span className="ml-3">Logout</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SuperAdminSidebar;
