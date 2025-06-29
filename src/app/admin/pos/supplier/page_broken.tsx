// filepath: c:\\Users\\USER-PC\\My Drive\\Sync App\\Ai\\Project\\app-101\\pos-app\\src\\app\\admin\\pos\\supplier\\page.tsx
'use client';

import React, { useState, useEffect, useContext } from 'react';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiEye, FiAlertCircle, FiTruck, FiLoader } from 'react-icons/fi';
import AddNewSupplierModal, { SupplierFormData as AddSupplierFormData } from '@/components/admin/AddNewSupplierModal';
import EditSupplierModal, { SupplierFormData as EditSupplierFormData } from '@/components/admin/EditSupplierModal';
import { AuthContext } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, onSnapshot, Timestamp, query, orderBy, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Supplier as SupplierType } from '@/types/pos';
import POSLayout from '@/components/admin/POSLayout';

export interface PageSupplier extends SupplierType {
  createdAt?: Timestamp;
}

const PosSupplierPage = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // State for Edit Modal
  const [selectedSupplier, setSelectedSupplier] = useState<PageSupplier | null>(null); // State for selected supplier
  const [suppliers, setSuppliers] = useState<PageSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false); // For loading state during save/update

  const authContext = useContext(AuthContext);
  const currentUser = authContext?.currentUser;

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
    setError(null); // Clear previous errors
    setIsAddModalOpen(true);
  }
  const handleCloseAddModal = () => setIsAddModalOpen(false);

  const handleOpenEditModal = (supplier: PageSupplier) => {
    setError(null); // Clear previous errors
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
      const adminDocRef = doc(db, `admins/${currentUser.uid}`);
      const adminDocSnap = await getDoc(adminDocRef);

      if (!adminDocSnap.exists()) {
        setError("Admin profile not found. Cannot save supplier.");
        console.error("Admin document does not exist for UID:", currentUser.uid);
        setIsSaving(false);
        return;
      }

      const suppliersCollectionRef = collection(db, `admins/${currentUser.uid}/suppliers`);
      const dataToSave: Omit<SupplierType, 'id'> & { createdAt: Timestamp } = {
        name: supplierData.name,
        adminId: currentUser.uid,
        createdAt: Timestamp.now(),
      };

      if (supplierData.contactPerson) dataToSave.contactPerson = supplierData.contactPerson;
      if (supplierData.email) dataToSave.email = supplierData.email;
      if (supplierData.phone) dataToSave.phone = supplierData.phone;
      if (supplierData.address) dataToSave.address = supplierData.address;
      if (supplierData.companyName) dataToSave.companyName = supplierData.companyName;
      if (supplierData.vatNumber) dataToSave.vatNumber = supplierData.vatNumber;
      if (supplierData.notes) dataToSave.notes = supplierData.notes;

      await addDoc(suppliersCollectionRef, dataToSave);
      console.log('New Supplier saved to Firestore');
      handleCloseAddModal();
    } catch (err) {
      console.error("Error saving supplier to Firestore:", err);
      setError("Failed to save supplier. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSupplier = async (supplierId: string, supplierData: EditSupplierFormData) => {
    if (!currentUser?.uid) {
      setError("Action failed: User not authenticated.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const supplierDocRef = doc(db, `admins/${currentUser.uid}/suppliers`, supplierId);
      
      // Construct the data to update, ensuring only defined fields are included
      const dataToUpdate: Partial<Omit<SupplierType, 'id' | 'adminId'>> & { updatedAt?: Timestamp } = {};
      dataToUpdate.name = supplierData.name; // Name is required
      if (supplierData.contactPerson !== undefined) dataToUpdate.contactPerson = supplierData.contactPerson;
      if (supplierData.email !== undefined) dataToUpdate.email = supplierData.email;
      if (supplierData.phone !== undefined) dataToUpdate.phone = supplierData.phone;
      if (supplierData.address !== undefined) dataToUpdate.address = supplierData.address;
      if (supplierData.companyName !== undefined) dataToUpdate.companyName = supplierData.companyName;
      if (supplierData.vatNumber !== undefined) dataToUpdate.vatNumber = supplierData.vatNumber;
      if (supplierData.notes !== undefined) dataToUpdate.notes = supplierData.notes;
      dataToUpdate.updatedAt = Timestamp.now(); // Add an updated timestamp

      await updateDoc(supplierDocRef, dataToUpdate);
      console.log('Supplier updated in Firestore');
      handleCloseEditModal();
    } catch (err) {
      console.error("Error updating supplier:", err);
      setError("Failed to update supplier. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!currentUser?.uid) {
      setError("Action failed: User not authenticated.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this supplier? This action cannot be undone.")) {
      return;
    }
    setError(null);
    setIsSaving(true); // Use isSaving for delete operation as well
    try {
      const supplierDocRef = doc(db, `admins/${currentUser.uid}/suppliers`, supplierId);
      await deleteDoc(supplierDocRef);
      console.log('Supplier deleted from Firestore');
      // Data will refresh due to onSnapshot, no need to manually update state
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
    (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

        {/* Search and Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-slate-200">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-grow w-full md:w-auto flex items-center border border-slate-300 rounded-lg px-3 py-2">
              <FiSearch className="text-slate-500 mr-2" />
              <input
                type="text"
                placeholder="Search suppliers by name, contact, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow focus:outline-none text-sm"
                disabled={!currentUser || isLoading || isSaving}
              />
            </div>
            <button
              onClick={handleOpenAddModal}
              disabled={!currentUser || isSaving} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPlus className="mr-2" size={16} /> Add Supplier
            </button>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-slate-200">
          {/* Table Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Supplier Directory ({filteredSuppliers.length})
                </h2>
                <p className="text-slate-600 text-sm mt-1">
                  Manage supplier contacts and business relationships
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <FiTruck size={14} />
                      Supplier Name
                    </div>
                  </th>
                  <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Contact Person</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Email</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Phone</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Company</th>
                  <th className="py-3 px-6 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="py-20 px-4 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                          <FiLoader className="animate-spin text-3xl text-white" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">Loading suppliers...</h3>
                        <p className="text-slate-500">Fetching supplier information</p>
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && !error && filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 px-4 text-center">
                      <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                        <FiTruck className="text-4xl text-blue-600" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 mb-3">No Suppliers Found</h3>
                      <p className="text-lg text-slate-600 mb-6 max-w-md mx-auto">
                        {searchTerm ? 'No results match your search criteria.' : 'Start by adding your first supplier to manage business relationships.'}
                      </p>
                      <button
                        onClick={handleOpenAddModal}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Add First Supplier
                      </button>
                    </td>
                  </tr>
                )}
                {!isLoading && !error && filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-blue-50 transition-colors border-b border-slate-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center border border-blue-200">
                          <FiTruck className="text-blue-600" size={16} />
                        </div>
                        <div className="font-semibold text-slate-900 text-lg">{supplier.name}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-slate-900">{supplier.contactPerson || '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-slate-900">{supplier.email || '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-slate-900">{supplier.phone || '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-slate-900">{supplier.companyName || '-'}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button 
                          onClick={() => handleOpenEditModal(supplier)}
                          disabled={isSaving}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                          title="Edit Supplier"
                        >
                          <FiEdit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSupplier(supplier.id)}
                          disabled={isSaving}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                          title="Delete Supplier"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isAddModalOpen && (
          <AddNewSupplierModal
            isOpen={isAddModalOpen}
            onClose={handleCloseAddModal}
            onSave={handleSaveSupplier}
            error={error}
            isLoading={isSaving}
          />
        )}

        {isEditModalOpen && selectedSupplier && (
          <EditSupplierModal
            isOpen={isEditModalOpen}
            onClose={handleCloseEditModal}
            onSave={handleUpdateSupplier}
            supplier={selectedSupplier}
            error={error}
            isLoading={isSaving}
          />
        )}
      </div>
    </POSLayout>
  );
};

export default PosSupplierPage;
