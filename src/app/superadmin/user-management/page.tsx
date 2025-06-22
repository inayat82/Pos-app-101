// src/app/superadmin/user-management/page.tsx
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiChevronDown, 
  FiChevronRight, 
  FiUsers, 
  FiUser, 
  FiMail, 
  FiCalendar,
  FiShield,
  FiSearch,
  FiRefreshCw,  FiEye,
  FiUserPlus,
  FiDownload,
  FiFilter
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  deleteDoc, 
  updateDoc, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import AddAdminModal from '@/components/superadmin/AddAdminModal';
import EditUserModal from '@/components/superadmin/EditUserModal';
import AddSubUserModal from '@/components/superadmin/AddSubUserModal';
import ConfirmDeleteModal from '@/components/superadmin/ConfirmDeleteModal';
import DatabaseDebugger from '@/components/superadmin/DatabaseDebugger';
import CreateFirstSuperAdmin from '@/components/superadmin/CreateFirstSuperAdmin';

interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin';
  createdAt?: Timestamp;
  lastLogin?: Timestamp;
  isActive?: boolean;
  subUsers?: SubUser[];
  subUserCount?: number;
}

interface SubUser {
  uid: string;
  email: string;
  displayName?: string;
  role: 'posuser' | 'takealotuser';
  adminId: string;
  createdAt?: Timestamp;
  lastLogin?: Timestamp;
  isActive?: boolean;
}

const SuperAdminUserManagementPage = () => {
  const { currentUser, userProfile } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [expandedAdmins, setExpandedAdmins] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [needsFirstSuperAdmin, setNeedsFirstSuperAdmin] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);const [selectedSubUser, setSelectedSubUser] = useState<SubUser | null>(null);
  const [isAdminDetailsOpen, setIsAdminDetailsOpen] = useState(false);
  const [isSubUserDetailsOpen, setIsSubUserDetailsOpen] = useState(false);
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);  const [isAddSubUserModalOpen, setIsAddSubUserModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<AdminUser | SubUser | null>(null);
  const [selectedAdminForSubUser, setSelectedAdminForSubUser] = useState<AdminUser | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{user: AdminUser | SubUser, type: 'admin' | 'subuser'} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);  // Fetch all admins and their sub-users
  const fetchAdminsAndSubUsers = useCallback(async () => {
    if (!currentUser) {
      console.log('No current user found');
      setError('User not authenticated. Please log in again.');
      setLoading(false);
      return;
    }    console.log('Fetching admins and sub-users, current user:', currentUser.uid, currentUser.email);
    console.log('User profile from AuthContext:', userProfile);
    
    if (!userProfile) {
      console.log('No user profile found in AuthContext');
      setNeedsFirstSuperAdmin(true);
      setLoading(false);
      return;
    }
      // Make role comparison case-insensitive to match UserRole.SuperAdmin
    const userRole = userProfile.role?.toLowerCase();
    const expectedRole = 'superadmin'; // UserRole.SuperAdmin.toLowerCase()
    console.log('User role (lowercase):', userRole);
    console.log('Expected role:', expectedRole);
    
    if (userRole !== expectedRole) {
      console.log('Access denied - user role is:', userProfile.role, 'but expected: SuperAdmin');
      setError(`Access denied. Your role is "${userProfile.role}" but SuperAdmin role is required.`);
      setLoading(false);
      return;
    }

    console.log('✅ SuperAdmin access granted! Proceeding to fetch admin users...');
    setLoading(true);
    setError(null);
    setNeedsFirstSuperAdmin(false);

    try {
      // Skip manual user profile fetch since we have it from AuthContext

      // Get basic access to the users collection
      const usersRef = collection(db, 'users');
      console.log('Users collection reference created');
      
      // Try to get all users first to test permissions
      const allUsersSnapshot = await getDocs(usersRef);
      console.log('Total users in database:', allUsersSnapshot.docs.length);
      
      // Log all users to see what we have
      allUsersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log('User found:', doc.id, data.email, data.role);
      });

      // Now fetch admin users specifically
      const adminQuery = query(
        usersRef, 
        where('role', '==', 'admin')
      );
      
      console.log('Executing admin query...');
      const adminSnapshot = await getDocs(adminQuery);
      console.log('Admin query results:', adminSnapshot.docs.length, 'documents');
      
      const adminsList: AdminUser[] = [];

      // Process each admin
      for (const adminDoc of adminSnapshot.docs) {
        const adminData = {
          uid: adminDoc.id,
          ...adminDoc.data()
        } as AdminUser;

        console.log('Processing admin:', adminData.email, adminData.uid);

        // Fetch sub-users for this admin
        const subUsersQuery = query(
          usersRef,
          where('adminId', '==', adminData.uid)
        );
        
        console.log('Fetching sub-users for admin:', adminData.uid);
        const subUsersSnapshot = await getDocs(subUsersQuery);
        console.log('Sub-users found:', subUsersSnapshot.docs.length);
        
        const subUsers: SubUser[] = subUsersSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as SubUser));

        adminData.subUsers = subUsers;
        adminData.subUserCount = subUsers.length;
        adminsList.push(adminData);
      }

      console.log('Final admin list:', adminsList.length, 'admins');
      
      // Sort admins by email on client side
      adminsList.sort((a, b) => a.email.localeCompare(b.email));
      
      setAdmins(adminsList);
      
      if (adminsList.length === 0) {
        setError('No admin users found in the database. Create an admin first.');
      }
    } catch (err: any) {
      console.error('Error fetching admins and sub-users:', err);
      console.error('Error details:', err.message, err.code, err.stack);
      
      if (err.code === 'permission-denied') {
        setError('Permission denied. Please ensure you are logged in as a SuperAdmin.');
      } else {
        setError(`Failed to load user data: ${err.message || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile]);

  useEffect(() => {
    fetchAdminsAndSubUsers();
  }, [fetchAdminsAndSubUsers]);

  // Toggle admin expansion
  const toggleAdminExpansion = (adminId: string) => {
    const newExpanded = new Set(expandedAdmins);
    if (newExpanded.has(adminId)) {
      newExpanded.delete(adminId);
    } else {
      newExpanded.add(adminId);
    }
    setExpandedAdmins(newExpanded);
  };

  // View admin details
  const viewAdminDetails = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setIsAdminDetailsOpen(true);
  };
  // Edit user (admin or sub-user)
  const editUser = (user: AdminUser | SubUser) => {
    setSelectedUserForEdit(user);
    setIsEditUserModalOpen(true);
  };
  // Add sub-user for a specific admin
  const addSubUser = (admin: AdminUser) => {
    setSelectedAdminForSubUser(admin);
    setIsAddSubUserModalOpen(true);
  };

  // View sub-user details
  const viewSubUserDetails = (subUser: SubUser) => {
    setSelectedSubUser(subUser);
    setIsSubUserDetailsOpen(true);
  };
  // Delete admin (with confirmation)
  const deleteAdmin = async (admin: AdminUser) => {
    setUserToDelete({user: admin, type: 'admin'});
    setIsConfirmDeleteOpen(true);
  };

  // Delete sub-user
  const deleteSubUser = async (subUser: SubUser) => {
    setUserToDelete({user: subUser, type: 'subuser'});
    setIsConfirmDeleteOpen(true);
  };

  // Confirm deletion
  const confirmDelete = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      if (userToDelete.type === 'admin') {
        const admin = userToDelete.user as AdminUser;
        
        // Delete admin document
        await deleteDoc(doc(db, 'users', admin.uid));
        
        // Delete admin's sub-users
        if (admin.subUsers) {
          for (const subUser of admin.subUsers) {
            await deleteDoc(doc(db, 'users', subUser.uid));
          }
        }

        // Delete admin's data collection
        try {
          await deleteDoc(doc(db, 'admins', admin.uid));
        } catch (err) {
          console.warn('Admin document may not exist in admins collection:', err);
        }
      } else {
        // Delete sub-user
        await deleteDoc(doc(db, 'users', userToDelete.user.uid));
      }

      await fetchAdminsAndSubUsers();
      setIsConfirmDeleteOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(`Failed to delete ${userToDelete.type}. Please try again.`);
    } finally {
      setIsDeleting(false);
    }
  };  // Export users data
  const exportUsersData = () => {
    const csvData = [];
    
    // Add headers
    csvData.push([
      'Type', 'Name', 'Email', 'Role', 'Status', 'Admin', 'Created At', 'Last Login'
    ]);

    // Add admin data
    admins.forEach(admin => {
      csvData.push([
        'Admin',
        admin.displayName || '',
        admin.email,
        'admin',
        admin.isActive !== false ? 'Active' : 'Inactive',
        '',
        admin.createdAt ? admin.createdAt.toDate().toLocaleDateString() : '',
        admin.lastLogin ? admin.lastLogin.toDate().toLocaleDateString() : ''
      ]);

      // Add sub-users
      admin.subUsers?.forEach(subUser => {
        csvData.push([
          'Sub-user',
          subUser.displayName || '',
          subUser.email,
          subUser.role,
          subUser.isActive !== false ? 'Active' : 'Inactive',
          admin.displayName || admin.email,
          subUser.createdAt ? subUser.createdAt.toDate().toLocaleDateString() : '',
          subUser.lastLogin ? subUser.lastLogin.toDate().toLocaleDateString() : ''
        ]);
      });
    });

    // Convert to CSV string
    const csvContent = csvData.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Toggle user active status
  const toggleUserStatus = async (userId: string, currentStatus: boolean = true) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isActive: !currentStatus,
        updatedAt: Timestamp.now()
      });
      await fetchAdminsAndSubUsers();
    } catch (err: any) {
      console.error('Error updating user status:', err);
      setError('Failed to update user status. Please try again.');
    }
  };

  // Filter admins based on search term
  const filteredAdmins = admins.filter(admin => 
    admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.subUsers?.some(subUser => 
      subUser.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subUser.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Format date
  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return 'Never';
    return timestamp.toDate().toLocaleDateString();
  };

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'posuser': return 'bg-green-100 text-green-800';
      case 'takealotuser': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show SuperAdmin setup if needed
  if (needsFirstSuperAdmin) {
    return <CreateFirstSuperAdmin />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>          
          
          {/* Temporary debug - show current user info */}
          {currentUser && (
            <div className="text-xs bg-gray-100 p-2 rounded">
              <div>Email: {currentUser.email}</div>
              <div>UID: {currentUser.uid}</div>
            </div>
          )}
          
          <div className="flex items-center space-x-4">
            <button
              onClick={exportUsersData}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <FiDownload className="mr-2" />
              Export CSV
            </button>            <button
              onClick={() => {
                setError(null);
                fetchAdminsAndSubUsers();
              }}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <FiRefreshCw className="mr-2" />
              Force Refresh
            </button>
            <button
              onClick={() => setIsAddAdminModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <FiPlus className="mr-2" />
              Add Admin
            </button>
          </div>
        </div>

        {/* Search and Stats */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
            <div className="flex items-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center bg-blue-50 px-3 py-2 rounded-lg">
              <FiShield className="mr-2 text-blue-600" />
              <span className="font-medium text-blue-800">{admins.length} Admins</span>
            </div>
            <div className="flex items-center bg-green-50 px-3 py-2 rounded-lg">
              <FiUsers className="mr-2 text-green-600" />
              <span className="font-medium text-green-800">
                {admins.reduce((total, admin) => total + admin.subUserCount!, 0)} Sub-users
              </span>
            </div>
            <div className="flex items-center bg-purple-50 px-3 py-2 rounded-lg">
              <FiUser className="mr-2 text-purple-600" />
              <span className="font-medium text-purple-800">
                {admins.reduce((total, admin) => total + admin.subUsers!.filter(u => u.role === 'posuser').length, 0)} POS Users
              </span>
            </div>
            <div className="flex items-center bg-orange-50 px-3 py-2 rounded-lg">
              <FiUser className="mr-2 text-orange-600" />
              <span className="font-medium text-orange-800">
                {admins.reduce((total, admin) => total + admin.subUsers!.filter(u => u.role === 'takealotuser').length, 0)} Takealot Users
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}
      </div>

      {/* Admin List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admin Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sub-users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAdmins.map((admin) => (
                <React.Fragment key={admin.uid}>
                  {/* Admin Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-10 h-10">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <FiShield className="text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {admin.displayName || 'No Name'}
                          </div>
                          <div className="text-sm text-gray-500">{admin.email}</div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(admin.role)}`}>
                            Admin
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">                        <div className="flex items-center">
                          {admin.subUserCount! > 0 ? (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleAdminExpansion(admin.uid)}
                                className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                              >
                                {expandedAdmins.has(admin.uid) ? (
                                  <FiChevronDown className="mr-1" />
                                ) : (
                                  <FiChevronRight className="mr-1" />
                                )}
                                {admin.subUserCount} sub-user{admin.subUserCount !== 1 ? 's' : ''}
                              </button>
                              <button
                                onClick={() => addSubUser(admin)}
                                className="flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                                title="Add Sub-user"
                              >
                                <FiUserPlus className="mr-1" size={12} />
                                Add
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addSubUser(admin)}
                              className="flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                              title="Add First Sub-user"
                            >
                              <FiUserPlus className="mr-1" size={12} />
                              Add Sub-user
                            </button>
                          )}
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleUserStatus(admin.uid, admin.isActive)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          admin.isActive !== false
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {admin.isActive !== false ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(admin.lastLogin)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => viewAdminDetails(admin)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <FiEye />
                        </button>                        <button
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Edit Admin"
                          onClick={() => editUser(admin)}
                        >
                          <FiEdit />
                        </button>                        <button
                          onClick={() => deleteAdmin(admin)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Admin"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Sub-users Rows */}
                  {expandedAdmins.has(admin.uid) && admin.subUsers && admin.subUsers.map((subUser) => (
                    <tr key={subUser.uid} className="bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center pl-8">
                          <div className="flex-shrink-0 w-8 h-8">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <FiUser className="text-gray-600 text-sm" />
                            </div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {subUser.displayName || 'No Name'}
                            </div>
                            <div className="text-sm text-gray-500">{subUser.email}</div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(subUser.role)}`}>
                              {subUser.role === 'posuser' ? 'POS User' : 'Takealot User'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        Sub-user of {admin.displayName || admin.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleUserStatus(subUser.uid, subUser.isActive)}
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            subUser.isActive !== false
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {subUser.isActive !== false ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(subUser.lastLogin)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => viewSubUserDetails(subUser)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                          >
                            <FiEye />
                          </button>                            <button
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Edit Sub-user"
                              onClick={() => editUser(subUser)}
                            >
                            <FiEdit />
                          </button>                            <button
                              onClick={() => deleteSubUser(subUser)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Sub-user"
                            >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAdmins.length === 0 && (
          <div className="text-center py-12">
            <FiUsers className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating a new admin.'}
            </p>
          </div>
        )}
      </div>

      {/* Admin Details Modal */}
      {isAdminDetailsOpen && selectedAdmin && (
        <AdminDetailsModal
          admin={selectedAdmin}
          onClose={() => setIsAdminDetailsOpen(false)}
        />
      )}      {/* Sub-user Details Modal */}
      {isSubUserDetailsOpen && selectedSubUser && (
        <SubUserDetailsModal
          subUser={selectedSubUser}
          onClose={() => setIsSubUserDetailsOpen(false)}
        />
      )}

      {/* Add Admin Modal */}
      <AddAdminModal
        isOpen={isAddAdminModalOpen}
        onClose={() => setIsAddAdminModalOpen(false)}
        onAdminAdded={fetchAdminsAndSubUsers}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={isEditUserModalOpen}
        onClose={() => setIsEditUserModalOpen(false)}
        onUserUpdated={fetchAdminsAndSubUsers}
        user={selectedUserForEdit}
      />

      {/* Add Sub-user Modal */}
      <AddSubUserModal
        isOpen={isAddSubUserModalOpen}
        onClose={() => setIsAddSubUserModalOpen(false)}
        onSubUserAdded={fetchAdminsAndSubUsers}        adminId={selectedAdminForSubUser?.uid || ''}
        adminName={selectedAdminForSubUser?.displayName || selectedAdminForSubUser?.email || ''}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setIsConfirmDeleteOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDelete}
        title={`Delete ${userToDelete?.type === 'admin' ? 'Admin' : 'Sub-user'}`}
        message={`Are you sure you want to delete "${userToDelete?.user?.displayName || userToDelete?.user?.email}"?`}
        type={userToDelete?.type || 'subuser'}
        isLoading={isDeleting}
      />
    </div>
  );
};

// Admin Details Modal Component
const AdminDetailsModal: React.FC<{
  admin: AdminUser;
  onClose: () => void;
}> = ({ admin, onClose }) => {
  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return 'Never';
    return timestamp.toDate().toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Admin Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <p className="mt-1 text-sm text-gray-900">{admin.displayName || 'No name provided'}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-900">{admin.email}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <p className="mt-1 text-sm text-gray-900">Admin</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <p className="mt-1 text-sm text-gray-900">
                {admin.isActive !== false ? 'Active' : 'Inactive'}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-users</label>
              <p className="mt-1 text-sm text-gray-900">{admin.subUserCount || 0}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Created At</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(admin.createdAt)}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Login</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(admin.lastLogin)}</p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Close
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Edit Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-user Details Modal Component
const SubUserDetailsModal: React.FC<{
  subUser: SubUser;
  onClose: () => void;
}> = ({ subUser, onClose }) => {
  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return 'Never';
    return timestamp.toDate().toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Sub-user Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <p className="mt-1 text-sm text-gray-900">{subUser.displayName || 'No name provided'}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-900">{subUser.email}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <p className="mt-1 text-sm text-gray-900">
                {subUser.role === 'posuser' ? 'POS User' : 'Takealot User'}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Admin ID</label>
              <p className="mt-1 text-sm text-gray-900 font-mono text-xs">{subUser.adminId}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <p className="mt-1 text-sm text-gray-900">
                {subUser.isActive !== false ? 'Active' : 'Inactive'}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Created At</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(subUser.createdAt)}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Login</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(subUser.lastLogin)}</p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Close
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Edit Sub-user
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminUserManagementPage;
