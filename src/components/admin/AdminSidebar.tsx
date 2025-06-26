'use client';

import { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthContext, AuthContextType } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  HomeIcon,
  ArchiveBoxIcon,
  ShoppingCartIcon,
  TagIcon,
  UsersIcon,
  Squares2X2Icon,
  UserIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  BuildingStorefrontIcon,
  ChevronRightIcon,
  ArrowLeftOnRectangleIcon,
  CogIcon,
  CircleStackIcon,
  LinkIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { FiAlertOctagon } from 'react-icons/fi';

// Interface for Takealot Integration
interface TakealotIntegration {
  id: string;
  accountName: string;
  assignedUserId: string;
  adminId: string;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const AdminSidebar: React.FC = () => {
  const [posProductOpen, setPosProductOpenState] = useState(false);
  const [purchaseSystemOpen, setPurchaseSystemOpenState] = useState(false);
  const [administrationOpen, setAdministrationOpenState] = useState(false);
  
  // State for dynamic Takealot integrations
  const [takealotIntegrations, setTakealotIntegrations] = useState<TakealotIntegration[]>([]);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
  
  const currentPathname = usePathname();
  const router = useRouter();
  const authContext = useContext<AuthContextType | undefined>(AuthContext);

  const logout = authContext?.logout;
  const currentUser = authContext?.currentUser;
  // Fetch Takealot integrations when component mounts or user changes
  useEffect(() => {
    if (currentUser?.uid) {
      fetchTakealotIntegrations();
    }
  }, [currentUser?.uid]);

  // Refresh integrations when on integration page
  useEffect(() => {
    if (currentUser?.uid && currentPathname === '/admin/integration') {
      fetchTakealotIntegrations();
    }
  }, [currentUser?.uid, currentPathname]);
  const fetchTakealotIntegrations = async () => {
    if (!currentUser?.uid) return;

    try {
      setIsLoadingIntegrations(true);
      const integrationsRef = collection(db, 'takealotIntegrations');
      const q = query(
        integrationsRef,
        where('adminId', '==', currentUser.uid)
        // Removed orderBy to avoid index issues
      );
      
      const querySnapshot = await getDocs(q);
      const integrationsList: TakealotIntegration[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        integrationsList.push({
          id: doc.id,
          accountName: data.accountName,
          assignedUserId: data.assignedUserId,
          adminId: data.adminId,
        });
      });
      
      // Sort by account name for consistent ordering
      integrationsList.sort((a, b) => a.accountName.localeCompare(b.accountName));
      
      setTakealotIntegrations(integrationsList);
    } catch (error) {
      console.error('Error fetching Takealot integrations:', error);
      // Don't show error in sidebar, just log it
    } finally {
      setIsLoadingIntegrations(false);
    }
  };

  const handleLogout = async () => {
    if (logout) {
      try {
        await logout();
        router.push('/auth/login'); 
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };
  
  // New divider component with centered title and lines
  const dividerWithTitle = (title: string) => (
    <div className="flex items-center justify-center px-3 py-4">
      <div className="flex-grow border-t border-slate-600"></div>
      <span className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {title}
      </span>
      <div className="flex-grow border-t border-slate-600"></div>
    </div>
  );
  
  const menuItemClass = (isActive: boolean) =>
    `flex items-center px-3 py-2.5 rounded-lg transition-colors duration-150 ease-in-out group ${
      isActive 
        ? 'bg-indigo-600 text-white shadow-md' 
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`;

  const subMenuItemClass = (isActive: boolean) =>
    `flex items-center pl-10 pr-3 py-2 rounded-lg transition-colors duration-150 ease-in-out group text-sm ${
      isActive
        ? 'bg-indigo-600 text-white' // Updated for consistency
        : 'text-slate-300 hover:bg-slate-700 hover:text-white' // Updated for consistency
    }`;
  const iconClass = (isActive: boolean) =>
    `h-5 w-5 mr-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`;

  const subIconClass = (isActive: boolean) =>
    `h-4 w-4 mr-2 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`; // Updated for consistency

  const isSubLinkActive = (linkHref: string) => currentPathname === linkHref;
  // Corrected: Added null check for currentPathname
  const isSectionActive = (links: Array<{href: string}>) => 
    currentPathname ? links.some(l => currentPathname === l.href || currentPathname.startsWith(l.href + '/')) : false;

  // Define links for the Administration section, including the updated Integration link
  const administrationLinks = [
    { name: 'Manage Users', href: '/admin/manage-users', icon: UsersIcon },
    { name: 'Manage Integrations', href: '/admin/integration', icon: LinkIcon }, // Updated href to point to the folder
    // Logs removed due to excessive Firebase writes causing performance issues
    // Add other admin-level settings/links here if needed
  ];  const posProductLinks = [
    { name: 'Product', href: '/admin/pos/product', icon: ArchiveBoxIcon },
    { name: 'Purchase', href: '/admin/pos/purchase', icon: ShoppingCartIcon },
    { name: 'Sales', href: '/admin/pos/sales', icon: BanknotesIcon },
    { name: 'Stock Adjustment', href: '/admin/pos/stock-adjustment', icon: AdjustmentsHorizontalIcon },
    { name: 'Supplier', href: '/admin/pos/supplier', icon: UsersIcon },
    { name: 'Customer', href: '/admin/pos/customer', icon: UserIcon },
    { name: 'Brand', href: '/admin/pos/brand', icon: TagIcon },
    { name: 'Categories', href: '/admin/pos/categories', icon: Squares2X2Icon },
    { name: 'Price Group', href: '/admin/pos/pricegroup', icon: TagIcon },
    { name: 'Report', href: '/admin/pos/reports', icon: DocumentTextIcon },
  ];const purchaseSystemLinks = [
    { name: 'Pending Purchase', href: '/admin/pos/purchase/pending', icon: ExclamationTriangleIcon },
    { name: 'Out Of Stock Item', href: '/admin/pos/purchase/out-of-stock', icon: FiAlertOctagon },
    { name: 'Purchase Order', href: '/admin/pos/purchase/order', icon: ClipboardDocumentListIcon },
  ];


  return (
    <nav className="flex flex-col h-full w-64 bg-slate-800 text-slate-100 shadow-lg">      {/* Logo Area */}
      <div className="flex items-center justify-center h-20 border-b border-slate-700 px-4">
        <Link href="/admin/dashboard" className="flex items-center space-x-2 text-xl font-semibold text-white">
          <BuildingStorefrontIcon className="h-8 w-8 text-indigo-400" />
          <span>POS System</span>
        </Link>
      </div><ul className="flex-1 p-2 space-y-1 overflow-y-auto">
        <li>
          <Link
            href="/admin/dashboard"
            className={menuItemClass(currentPathname === '/admin/dashboard')}
          >
            <HomeIcon className={iconClass(currentPathname === '/admin/dashboard')} />
            Dashboard
          </Link>
        </li>

        {/* POS Section Divider */}
        <li>{dividerWithTitle('POS')}</li>

        {/* POS Product Accordion */}
        <li>
          <button
            className={classNames(menuItemClass(posProductOpen || isSectionActive(posProductLinks)), "w-full justify-between")}
            onClick={() => setPosProductOpenState((open) => !open)}
            aria-expanded={posProductOpen}
          >
            <span className="flex items-center">
              <CircleStackIcon className={iconClass(posProductOpen || isSectionActive(posProductLinks))} />
              POS Product
            </span>
            <ChevronRightIcon className={`h-4 w-4 transition-transform duration-200 ${posProductOpen ? 'rotate-90' : ''}`} />
          </button>
          {posProductOpen && (
            <ul className="mt-1 space-y-1">
              {posProductLinks.map(link => {
                const isActive = isSubLinkActive(link.href);
                return (
                  <li key={link.name}>
                    <Link href={link.href} className={subMenuItemClass(isActive)}>
                      <link.icon className={subIconClass(isActive)} /> {link.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </li>        <li>
          {/* Purchase System Accordion */}
          <button
            className={classNames(menuItemClass(purchaseSystemOpen || isSectionActive(purchaseSystemLinks)), "w-full justify-between")}
            onClick={() => setPurchaseSystemOpenState((open) => !open)}
            aria-expanded={purchaseSystemOpen}
          >
            <span className="flex items-center">
              <ClipboardDocumentListIcon className={iconClass(purchaseSystemOpen || isSectionActive(purchaseSystemLinks))} />
              Purchase System
            </span>
            <ChevronRightIcon className={`h-4 w-4 transition-transform duration-200 ${purchaseSystemOpen ? 'rotate-90' : ''}`} />
          </button>
          {purchaseSystemOpen && (
            <ul className="mt-1 space-y-1">
              {purchaseSystemLinks.map(link => {
                const isActive = isSubLinkActive(link.href);
                return (
                  <li key={link.name}>
                    <Link href={link.href} className={subMenuItemClass(isActive)}>
                      <link.icon className={subIconClass(isActive)} /> {link.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </li>{/* Integrations Section Divider */}
        <li>{dividerWithTitle('INTEGRATIONS')}</li>
          
          {/* Dynamic Takealot Integrations */}
          {isLoadingIntegrations ? (
            <div className="px-4 py-2 text-sm text-slate-400">Loading integrations...</div>
          ) : takealotIntegrations.length > 0 ? (
            takealotIntegrations.map((integration) => {
              const isIntegrationActive = currentPathname?.includes(`/admin/takealot/${integration.id}`) || false;
              return (
                <li key={integration.id} className="mt-2">
                  <button
                    className={classNames(
                      menuItemClass(isIntegrationActive),
                      "w-full justify-between"
                    )}
                    onClick={() => {
                      if (!isIntegrationActive) {
                        router.push(`/admin/takealot/${integration.id}/products`);
                      }
                    }}
                    aria-expanded={isIntegrationActive}
                  >                    <span className="flex items-center">
                      <BuildingStorefrontIcon className={iconClass(isIntegrationActive)} />
                      <div className="flex flex-col items-start ml-3">
                        <span className="text-sm font-medium">Takealot</span>
                        <span className={`text-xs font-normal ${
                          isIntegrationActive ? 'text-indigo-200' : 'text-slate-400'
                        }`}>({integration.accountName})</span>
                      </div>
                    </span>
                    <ChevronRightIcon 
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isIntegrationActive ? 'rotate-90' : ''
                      }`} 
                    />
                  </button>
                    {/* Sub-menu for each integration */}
                  {isIntegrationActive && (
                    <ul className="mt-1 space-y-1">
                      <li>
                        <Link 
                          href={`/admin/takealot/${integration.id}/products`} 
                          className={subMenuItemClass(currentPathname === `/admin/takealot/${integration.id}/products`)}
                        >
                          <ArchiveBoxIcon className={subIconClass(currentPathname === `/admin/takealot/${integration.id}/products`)} />
                          Products
                        </Link>
                      </li>                      <li>
                        <Link 
                          href={`/admin/takealot/${integration.id}/sales`} 
                          className={subMenuItemClass(currentPathname === `/admin/takealot/${integration.id}/sales`)}
                        >
                          <BanknotesIcon className={subIconClass(currentPathname === `/admin/takealot/${integration.id}/sales`)} />
                          Sales
                        </Link>
                      </li>
                      <li>
                        <Link 
                          href={`/admin/takealot/${integration.id}/reports`} 
                          className={subMenuItemClass(currentPathname === `/admin/takealot/${integration.id}/reports`)}
                        >
                          <DocumentTextIcon className={subIconClass(currentPathname === `/admin/takealot/${integration.id}/reports`)} />
                          Reports
                        </Link>
                      </li>
                      <li>
                        <Link 
                          href={`/admin/takealot/${integration.id}/settings`} 
                          className={subMenuItemClass(currentPathname === `/admin/takealot/${integration.id}/settings`)}
                        >
                          <CogIcon className={subIconClass(currentPathname === `/admin/takealot/${integration.id}/settings`)} />
                          Settings
                        </Link>
                      </li>
                    </ul>
                  )}
                </li>
              );
            })
          ) : (
            <li className="px-4 py-2 text-sm text-slate-400">
              No integrations yet. 
              <Link href="/admin/integration" className="text-blue-400 hover:text-blue-300 ml-1">
                Add one?
              </Link>
            </li>
          )}

        {/* Administration Section Divider */}
        <li>{dividerWithTitle('ADMINISTRATION')}</li>

        {/* Administration Section */}
        <li>
          <button
            className={classNames(menuItemClass(administrationOpen || isSectionActive(administrationLinks)), "w-full justify-between")}
            onClick={() => setAdministrationOpenState((open) => !open)}
            aria-expanded={administrationOpen}
          >
            <span className="flex items-center">
              <CogIcon className={iconClass(administrationOpen || isSectionActive(administrationLinks))} />
              Administration
            </span>
            <ChevronRightIcon className={`h-4 w-4 transition-transform duration-200 ${administrationOpen ? 'rotate-90' : ''}`} />
          </button>
          {administrationOpen && (
            <ul className="mt-1 space-y-1">
              {administrationLinks.map(link => {
                const isActive = isSubLinkActive(link.href);
                return (
                  <li key={link.name}>
                    <Link href={link.href} className={subMenuItemClass(isActive)}>
                      <link.icon className={subIconClass(isActive)} /> {link.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </li>

        {/* Line Separator before Logout */}
        <li><hr className="my-2 border-slate-700" /></li>

        {/* Logout Button */}
        <div className="px-2 py-4 mt-auto"> {/* Removed border-t as HR is added above */}
          {currentUser && (
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-600 hover:text-white transition-colors duration-150 ease-in-out group"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-3 text-slate-400 group-hover:text-white" />
              Logout
            </button>
          )}
        </div>
      </ul>
    </nav>
  );
};

export default AdminSidebar;
