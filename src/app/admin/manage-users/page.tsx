'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import AddNewUserModal from '@/components/admin/AddNewUserModal';
import { FiPlusCircle, FiEye, FiTrash2 } from 'react-icons/fi';
import ViewUserModal from '@/components/admin/ViewUserModal';
import EditUserModal from '@/components/admin/EditUserModal';
import { UserProfile, UserRole } from '@/types/user';

const ManageUsersPage = () => {
    const { currentUser } = useAuth(); 
    const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null);
    const [subUsers, setSubUsers] = useState<UserProfile[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [selectedUserForView, setSelectedUserForView] = useState<UserProfile | null>(null);
    const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);

    const fetchAdminProfile = useCallback(async () => {
        if (currentUser?.uid) { 
            try {
                const adminDocRef = doc(db, 'users', currentUser.uid); 
                const adminDocSnap = await getDoc(adminDocRef);
                if (adminDocSnap.exists()) {
                    const adminData = adminDocSnap.data() as UserProfile;
                    if (adminData.role === UserRole.Admin) {
                        setAdminProfile(adminData);
                        return adminData;
                    } else {
                        setError("User is not an Admin.");
                        setAdminProfile(null); 
                    }
                } else {
                    setError("Admin profile not found.");
                    setAdminProfile(null); 
                }
            } catch (err) {
                console.error("Error fetching admin profile:", err);
                setError("Failed to fetch admin profile.");
                setAdminProfile(null); 
            }
        }
        return null;
    }, [currentUser?.uid]); 

    const fetchSubUsers = useCallback(async (adminId: string) => {
        try {
            const q = query(collection(db, 'users'), where('adminId', '==', adminId));
            const querySnapshot = await getDocs(q);
            const usersList = querySnapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            } as UserProfile)); 
            setSubUsers(usersList);
        } catch (err) {
            console.error("Error fetching sub-users:", err);
            setError("Failed to fetch sub-users.");
            setSubUsers([]); 
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            setAdminProfile(null); 
            setSubUsers([]); 
            
            const currentAdminProfile = await fetchAdminProfile();
            
            if (currentAdminProfile && currentAdminProfile.uid) {
                await fetchSubUsers(currentAdminProfile.uid);
            } 
            setIsLoading(false);
        };

        if (currentUser?.uid) { 
            loadData();
        } else if (!currentUser) { 
            setIsLoading(false); 
        }
    }, [currentUser, fetchAdminProfile, fetchSubUsers]); 

    useEffect(() => {
        const newAllUsers: UserProfile[] = [];
        if (adminProfile) {
            newAllUsers.push(adminProfile);
        }
        newAllUsers.push(...subUsers);
        setAllUsers(newAllUsers);
    }, [adminProfile, subUsers]);

    const handleUserAdded = async () => {
        setIsAddUserModalOpen(false);
        if (currentUser?.uid) { 
            setIsLoading(true);
            const currentAdminProfile = await fetchAdminProfile(); 
            if (currentAdminProfile && currentAdminProfile.uid) {
                await fetchSubUsers(currentAdminProfile.uid); 
            }
            setIsLoading(false);
        }
    };

    const openViewModal = (userData: UserProfile) => {
        setSelectedUserForView(userData);
    };

    const closeViewModal = () => {
        setSelectedUserForView(null);
    };

    // This function will now be called from ViewUserModal
    const openEditModal = (userData: UserProfile) => {
        setSelectedUserForView(null); // Close view modal if open
        setSelectedUserForEdit(userData);
    };

    const closeEditModal = () => {
        setSelectedUserForEdit(null);
    };

    const handleUserUpdate = () => {
        // Refresh data after update
        if (currentUser?.uid) {
            fetchAdminProfile(); // Refetches admin and their sub-users
            fetchSubUsers(currentUser.uid);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><p>Loading user data...</p></div>;
    }

    if (error && !adminProfile) { 
        return <div className="text-red-500 text-center mt-10"><p>Error: {error}</p></div>;
    }

    if (!currentUser || !adminProfile) { 
        return <div className="text-center mt-10"><p>You must be logged in as an Admin to view this page, or your admin profile could not be loaded.</p></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
                <button
                    onClick={() => setIsAddUserModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center transition duration-150 ease-in-out"
                >
                    <FiPlusCircle className="mr-2" /> Add New User
                </button>
            </div>

            {error && <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-400 rounded-md"><p>Notice: {error}</p></div>} 

            <div className="bg-white shadow-xl rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-100 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-700">User List</h2>
                    <p className="text-sm text-gray-500">Manage your profile and sub-users.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {allUsers.length > 0 ? allUsers.map((u) => (
                                <tr key={u.uid} className="hover:bg-gray-50 transition duration-150">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{u.name || u.displayName || 'N/A'}</div>
                                        {u.username && <div className="text-xs text-gray-500">@{u.username}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{u.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            u.role === UserRole.Admin ? 'bg-green-100 text-green-800' :
                                            u.role === UserRole.TakealotUser ? 'bg-blue-100 text-blue-800' :
                                            u.role === UserRole.POSUser ? 'bg-indigo-100 text-indigo-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            Active
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => openViewModal(u)} className="text-blue-600 hover:text-blue-800 mr-3 transition duration-150 ease-in-out" title="View User">
                                            <FiEye size={18} />
                                        </button>
                                        {/* Edit button removed from here */}
                                        {u.uid !== adminProfile?.uid && ( // Prevent Admin from deleting themselves
                                            <button className="text-red-600 hover:text-red-800 transition duration-150 ease-in-out" title="Delete User">
                                                <FiTrash2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                                        {(adminProfile && subUsers.length === 0) ? 'No sub-users found. Add your first sub-user!' : 'No users to display.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isAddUserModalOpen && adminProfile && (
                <AddNewUserModal
                    isOpen={isAddUserModalOpen}
                    onClose={() => setIsAddUserModalOpen(false)}
                    onUserAdded={handleUserAdded}
                    adminId={adminProfile.uid}
                />
            )}
            {selectedUserForView && (
                <ViewUserModal
                    isOpen={!!selectedUserForView}
                    onClose={closeViewModal}
                    user={selectedUserForView}
                    onOpenEditModal={openEditModal} // Pass the function to open edit modal
                />
            )}
            {selectedUserForEdit && adminProfile && (
                <EditUserModal
                    isOpen={!!selectedUserForEdit}
                    onClose={closeEditModal}
                    user={selectedUserForEdit}
                    onUserUpdate={handleUserUpdate} // Pass the handler
                    currentAdminId={adminProfile.uid} // Pass current admin's ID
                />
            )}
        </div>
    );
};

export default ManageUsersPage;
