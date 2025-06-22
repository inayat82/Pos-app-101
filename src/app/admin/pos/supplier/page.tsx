// filepath: c:\\Users\\USER-PC\\My Drive\\Sync App\\Ai\\Project\\app-101\\pos-app\\src\\app\\admin\\pos\\supplier\\page.tsx
'use client';

import React, { useState, useEffect, useContext } from 'react';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiEye, FiAlertCircle } from 'react-icons/fi';
import AddNewSupplierModal, { SupplierFormData as AddSupplierFormData } from '@/components/admin/AddNewSupplierModal';
import EditSupplierModal, { SupplierFormData as EditSupplierFormData } from '@/components/admin/EditSupplierModal'; // Import EditSupplierModal
import { AuthContext } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, onSnapshot, Timestamp, query, orderBy, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Supplier as SupplierType } from '@/types/pos';

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

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">POS Suppliers</h1>
        <button
          onClick={handleOpenAddModal}
          disabled={!currentUser || isSaving} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiPlus className="mr-2" /> Add New Supplier
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-400 rounded-md flex items-center">
          <FiAlertCircle className="mr-2 h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex items-center">
          <FiSearch className="text-gray-500 mr-3 h-5 w-5" />
          <input
            type="text"
            placeholder="Search suppliers by name, contact, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!currentUser || isLoading || isSaving}
          />
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
              <th className="py-3 px-6 text-left">Supplier Name</th>
              <th className="py-3 px-6 text-left">Contact Person</th>
              <th className="py-3 px-6 text-left">Email</th>
              <th className="py-3 px-6 text-left">Phone</th>
              <th className="py-3 px-6 text-left">Company</th>
              <th className="py-3 px-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-4 px-6 text-center text-gray-500">
                  Loading suppliers...
                </td>
              </tr>
            )}
            {!isLoading && !error && filteredSuppliers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 px-6 text-center text-gray-500">
                  No suppliers found. Click "Add New Supplier" to get started.
                </td>
              </tr>
            )}
            {!isLoading && !error && filteredSuppliers.map((supplier) => (
              <tr key={supplier.id} className="border-b border-gray-200 hover:bg-gray-100">
                <td className="py-3 px-6 text-left whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="font-medium">{supplier.name}</span>
                  </div>
                </td>
                <td className="py-3 px-6 text-left">{supplier.contactPerson || '-'}</td>
                <td className="py-3 px-6 text-left">{supplier.email || '-'}</td>
                <td className="py-3 px-6 text-left">{supplier.phone || '-'}</td>
                <td className="py-3 px-6 text-left">{supplier.companyName || '-'}</td>
                <td className="py-3 px-6 text-center">
                  <div className="flex item-center justify-center space-x-2">
                    <button 
                      onClick={() => handleOpenEditModal(supplier)}
                      disabled={isSaving}
                      className="text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Edit Supplier"
                    >
                      <FiEdit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteSupplier(supplier.id)}
                      disabled={isSaving}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete Supplier"
                    >
                      <FiTrash2 size={18} />
                    </button>
                    {/* Add View button/modal if needed */}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAddModalOpen && (
        <AddNewSupplierModal
          isOpen={isAddModalOpen}
          onClose={handleCloseAddModal}
          onSave={handleSaveSupplier}
          error={error} // Pass page-level error to modal
          isLoading={isSaving} // Pass saving state to modal
        />
      )}

      {isEditModalOpen && selectedSupplier && (
        <EditSupplierModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleUpdateSupplier}
          supplier={selectedSupplier}
          error={error} // Pass page-level error to modal
          isLoading={isSaving} // Pass saving state to modal
        />
      )}
    </div>
  );
};

export default PosSupplierPage;
