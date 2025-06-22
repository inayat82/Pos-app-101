import React, { useContext, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { AuthContext, AuthContextType } from "@/context/AuthContext";
import { UserRole } from "@/types/user";
import { useRouter } from "next/navigation";
import { BuildingStorefrontIcon, UserCircleIcon, ChevronDownIcon, ArrowLeftOnRectangleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

interface TopbarProps {
  pageTitle?: string;
}

const Topbar: React.FC<TopbarProps> = ({ pageTitle }) => {
  const authContext = useContext<AuthContextType | undefined>(AuthContext);
  const router = useRouter();

  // Corrected: Use UserRole enum for comparisons and access properties according to type
  let profileDisplayName = "User";
  if (authContext?.userProfile) {
    const { role, ...profile } = authContext.userProfile;
    if (role === UserRole.Admin || role === UserRole.TakealotUser || role === UserRole.POSUser) {
      // Assuming AdminUserProfile, TakealotUserProfile, POSUserProfile have 'name' or a similar field.
      // AuthContext currently defines 'name' for AdminUserProfile.
      // If TakealotUserProfile/POSUserProfile have 'firstName', adjust accordingly.
      profileDisplayName = (profile as any).name || (profile as any).firstName || profileDisplayName;
    } else if (role === UserRole.SuperAdmin) {
      // SuperAdminProfile has 'name'
      profileDisplayName = (profile as any).name || profileDisplayName;
    }
  }
  const displayName = authContext?.currentUser?.displayName || profileDisplayName;
  const logout = authContext?.logout;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    if (logout) {
      try {
        await logout();
        router.push('/auth/login');
      } catch (error) {
        console.error("Failed to logout:", error);
      }
    }
    setMenuOpen(false);
  };
  return (
    <header className="w-full h-16 bg-slate-50 shadow-md flex items-center justify-between px-4 md:px-6 z-40 sticky top-0">      {/* Logo and App Name */}
      <div className="flex items-center space-x-4">
        <Link href="/admin/dashboard" className="flex items-center space-x-2 text-xl font-semibold text-slate-700 hover:text-indigo-600 transition-colors">
          <BuildingStorefrontIcon className="h-7 w-7 text-indigo-600" />
          <span>POS System</span>
        </Link>
        
        {/* Page Title */}
        {pageTitle && (
          <div className="hidden md:flex items-center">
            <span className="text-slate-400 mx-2">|</span>
            <h1 className="text-lg font-medium text-slate-600">{pageTitle}</h1>
          </div>
        )}
      </div>

      {/* User Menu */}
      <div className="relative" ref={menuRef}>
        <button
          className="flex items-center space-x-2 focus:outline-none px-3 py-2 rounded-md hover:bg-slate-200 transition-colors"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <UserCircleIcon className="h-7 w-7 text-slate-500" />
          <span className="font-medium text-slate-700 text-sm truncate max-w-[120px] hidden sm:block">{displayName}</span>
          <ChevronDownIcon className="w-5 h-5 text-slate-500" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 animate-fade-in">
            <div className="px-4 py-3 border-b border-slate-200">
              <p className="text-sm font-semibold text-slate-700 truncate">{displayName}</p>
              {authContext?.currentUser?.email && (
                <p className="text-xs text-slate-500 truncate">{authContext.currentUser.email}</p>
              )}
            </div>
            <Link
              href="/admin/profile"
              className="flex items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors group"
              onClick={() => setMenuOpen(false)}
            >
              <PencilSquareIcon className="h-5 w-5 mr-2.5 text-slate-400 group-hover:text-indigo-500" />
              Edit Profile
            </Link>
            <button
              className="w-full text-left flex items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors group"
              onClick={handleLogout}
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-2.5 text-slate-400 group-hover:text-red-500" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
