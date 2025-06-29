'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiEye, FiAlertCircle, FiTruck, FiLoader, FiPhone, FiMail, FiMapPin } from 'react-icons/fi';
import AddNewSupplierModal, { SupplierFormData as AddSupplierFormData } from '@/components/admin/AddNewSupplierModal';
import EditSupplierModal, { SupplierFormData as EditSupplierFormData } from '@/components/admin/EditSupplierModal';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, onSnapshot, Timestamp, query, orderBy, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Supplier as SupplierType } from '@/types/pos';
import POSLayout from '@/components/admin/POSLayout';

export interface PageSupplier extends SupplierType {
  createdAt?: Timestamp;
}

const SupplierPage = () => {
  const { currentUser } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<PageSupplier | null>(null);
  const [suppliers, setSuppliers] = useState<PageSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  useEffect(() => {
    if (!currentUser?.uid) {
      setError("User not authenticated. Please log in.");
      setIsLoading(false);
      setSuppliers([]);
      return;
    }
    setError(null);
    setIsLoading(true);

    const suppliersCollectionRef = collection(db, `admins/${currentUser.uid}/suppliers`);
    const q = query(suppliersCollectionRef, orderBy("name", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSuppliers = snapshot.docs.map(doc => ({
        id: doc.id,
        adminId: currentUser.uid,
        ...(doc.data() as Omit<PageSupplier, 'id' | 'adminId'>),
      }));
      setSuppliers(fetchedSuppliers);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching suppliers:", err);
      setError("Failed to fetch suppliers. Please try again later.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleOpenAddModal = () => {
    setError(null);
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => setIsAddModalOpen(false);

  const handleOpenEditModal = (supplier: PageSupplier) => {
    setError(null);
    setSelectedSupplier(supplier);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setSelectedSupplier(null);
    setIsEditModalOpen(false);
  };

  const handleSaveSupplier = async (supplierData: AddSupplierFormData) => {
    if (!currentUser?.uid) {
      setError("Action failed: User not authenticated.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const suppliersCollectionRef = collection(db, `admins/${currentUser.uid}/suppliers`);
      const dataToSave: Omit<SupplierType, 'id'> & { createdAt: Timestamp } = {
        name: supplierData.name,
        adminId: currentUser.uid,
        createdAt: Timestamp.now(),
        ...(supplierData.contactPerson && { contactPerson: supplierData.contactPerson }),
        ...(supplierData.phone && { phone: supplierData.phone }),
        ...(supplierData.email && { email: supplierData.email }),
        ...(supplierData.address && { address: supplierData.address }),
        ...(supplierData.notes && { notes: supplierData.notes }),
      };

      await addDoc(suppliersCollectionRef, dataToSave);
      handleCloseAddModal();
      console.log('Supplier added to Firestore');
    } catch (err) {
      console.error("Error adding supplier:", err);
      setError("Failed to save supplier. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSupplier = async (supplierId: string, supplierData: EditSupplierFormData) => {
    if (!currentUser?.uid || !selectedSupplier) {
      setError("Action failed: User not authenticated or no supplier selected.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const supplierDocRef = doc(db, `admins/${currentUser.uid}/suppliers`, selectedSupplier.id);
      const dataToUpdate = {
        name: supplierData.name,
        ...(supplierData.contactPerson !== undefined && { contactPerson: supplierData.contactPerson }),
        ...(supplierData.phone !== undefined && { phone: supplierData.phone }),
        ...(supplierData.email !== undefined && { email: supplierData.email }),
        ...(supplierData.address !== undefined && { address: supplierData.address }),
        ...(supplierData.notes !== undefined && { notes: supplierData.notes }),
        updatedAt: Timestamp.now(),
      };

      await updateDoc(supplierDocRef, dataToUpdate);
      handleCloseEditModal();
      console.log('Supplier updated in Firestore');
    } catch (err) {
      console.error("Error updating supplier:", err);
      setError("Failed to update supplier. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string, supplierName: string) => {
    if (!currentUser?.uid) {
      setError("Action failed: User not authenticated.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${supplierName}"? This action cannot be undone.`)) {
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const supplierDocRef = doc(db, `admins/${currentUser.uid}/suppliers`, supplierId);
      await deleteDoc(supplierDocRef);
      console.log('Supplier deleted from Firestore');
    } catch (err) {
      console.error("Error deleting supplier:", err);
      setError("Failed to delete supplier. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.contactPerson && supplier.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.phone && supplier.phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const currentRecords = filteredSuppliers.slice(0, recordsPerPage);

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
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
            <div className="flex items-center">
              <FiAlertCircle className="mr-3 text-red-500" size={20} />
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <FiTruck className="text-blue-600 text-xl mr-3" />
            <div>
              <div className="text-sm text-slate-600">Total Suppliers</div>
              <div className="text-2xl font-bold text-slate-900">{suppliers.length}</div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <FiLoader className="animate-spin text-3xl text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Loading suppliers...</h3>
              <p className="text-slate-500">Fetching supplier information</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Suppliers</h2>
                  <p className="text-slate-600 text-sm mt-1">
                    Showing {currentRecords.length} of {filteredSuppliers.length} suppliers
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search suppliers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
                    />
                  </div>
                  
                  <select
                    value={recordsPerPage}
                    onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={10}>Show 10</option>
                    <option value={25}>Show 25</option>
                    <option value={50}>Show 50</option>
                    <option value={100}>Show 100</option>
                  </select>
                  
                  <button
                    onClick={handleOpenAddModal}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FiPlus size={16} />
                    Add New Supplier
                  </button>
                </div>
              </div>
            </div>

            {/* Suppliers Table */}
            {currentRecords.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <FiTruck className="text-4xl text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-700 mb-2">
                  {searchTerm ? 'No suppliers found' : 'No suppliers yet'}
                </h3>
                <p className="text-slate-500 mb-6">
                  {searchTerm 
                    ? 'Try adjusting your search terms.'
                    : 'Get started by adding your first supplier.'
                  }
                </p>
                {!searchTerm && (
                  <button
                    onClick={handleOpenAddModal}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <FiPlus size={16} />
                    Add Your First Supplier
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Supplier Name
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Contact Person
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Contact Info
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Address
                      </th>
                      <th className="py-3 px-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {currentRecords.map((supplier) => (
                      <tr key={supplier.id} className="hover:bg-blue-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <FiTruck className="text-blue-600" size={16} />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{supplier.name}</div>
                              <div className="text-xs text-slate-500">
                                Added: {supplier.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {supplier.contactPerson || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {supplier.phone && (
                              <div className="flex items-center text-sm text-slate-600">
                                <FiPhone size={12} className="mr-2" />
                                {supplier.phone}
                              </div>
                            )}
                            {supplier.email && (
                              <div className="flex items-center text-sm text-slate-600">
                                <FiMail size={12} className="mr-2" />
                                {supplier.email}
                              </div>
                            )}
                            {!supplier.phone && !supplier.email && (
                              <span className="text-slate-400">No contact info</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {supplier.address ? (
                            <div className="flex items-start text-sm">
                              <FiMapPin size={12} className="mr-2 mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-2">{supplier.address}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">No address</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button 
                            onClick={() => handleOpenEditModal(supplier)}
                            className="text-blue-600 hover:text-blue-800 mr-2 p-1" 
                            title="Edit Supplier"
                            disabled={isSaving}
                          >
                            <FiEdit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                            className="text-red-600 hover:text-red-800 p-1" 
                            title="Delete Supplier"
                            disabled={isSaving}
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            {currentRecords.length > 0 && (
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-slate-600">
                    Showing <span className="font-semibold">{currentRecords.length}</span> of{' '}
                    <span className="font-semibold">{filteredSuppliers.length}</span> suppliers
                  </div>
                  {filteredSuppliers.length > recordsPerPage && (
                    <button
                      onClick={() => setRecordsPerPage(prev => prev + 25)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Load More
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Supplier Modal */}
        {isAddModalOpen && (
          <AddNewSupplierModal
            isOpen={isAddModalOpen}
            onClose={handleCloseAddModal}
            onSave={handleSaveSupplier}
            isLoading={isSaving}
          />
        )}

        {/* Edit Supplier Modal */}
        {isEditModalOpen && selectedSupplier && (
          <EditSupplierModal
            isOpen={isEditModalOpen}
            onClose={handleCloseEditModal}
            supplier={selectedSupplier}
            onSave={handleUpdateSupplier}
            isLoading={isSaving}
          />
        )}
      </div>
    </POSLayout>
  );
};

export default SupplierPage;
