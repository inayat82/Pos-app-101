// filepath: c:\\Users\\USER-PC\\My Drive\\Sync App\\Ai\\Project\\app-101\\pos-app\\src\\app\\admin\\pos\\customer\\page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiEye } from 'react-icons/fi';
import AddNewCustomerModal from '@/components/admin/AddNewCustomerModal';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  onSnapshot
} from 'firebase/firestore';

// Define the Customer type
interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  // Add any other fields that your AddNewCustomerModal might return
  companyName?: string;
  vatNumber?: string;
  customerType?: string;
  createdAt?: any; // Firestore timestamp
}

const PosCustomerPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]); // State for customers
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentUser } = useAuth();

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  useEffect(() => {
    if (currentUser?.uid) {
      setIsLoading(true);
      setError(null);
      const customersColRef = collection(db, 'admins', currentUser.uid, 'customers');
      const q = query(customersColRef); // Add ordering if needed

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedCustomers: Customer[] = [];
        querySnapshot.forEach((doc) => {
          fetchedCustomers.push({ id: doc.id, ...doc.data() } as Customer);
        });
        setCustomers(fetchedCustomers);
        setIsLoading(false);
      }, (err) => {
        console.error("Error fetching customers: ", err);
        setError("Failed to load customers. Please try again.");
        setIsLoading(false);
      });

      return () => unsubscribe();
    } else {
      setCustomers([]);
      setIsLoading(false);
    }
  }, [currentUser]);

  const handleSaveCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt'>) => {
    if (!currentUser?.uid) {
      setError("You must be logged in to add a customer.");
      console.error("User not logged in");
      return;
    }
    setError(null);
    try {
      const customersColRef = collection(db, 'admins', currentUser.uid, 'customers');
      const newCustomerDoc = await addDoc(customersColRef, {
        ...customerData,
        createdAt: serverTimestamp(),
      });
      console.log("Customer added with ID: ", newCustomerDoc.id);
      handleCloseModal();
    } catch (err) {
      console.error("Error adding customer to Firestore: ", err);
      setError("Failed to save customer. Please try again.");
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">POS Customers</h1>
        <button
          onClick={handleOpenModal} // Connect button to open modal
          disabled={!currentUser}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiPlus className="mr-2" /> Add New Customer
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md shadow" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex items-center">
          <FiSearch className="text-gray-500 mr-3 h-5 w-5" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            className="flex-grow p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
              <th className="py-3 px-6 text-left">Name</th>
              <th className="py-3 px-6 text-left">Email</th>
              <th className="py-3 px-6 text-left">Phone</th>
              <th className="py-3 px-6 text-left">Address</th>
              <th className="py-3 px-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {isLoading && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500">Loading customers...</td>
              </tr>
            )}
            {!isLoading && !error && customers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500">
                  No customers found. Click &quot;Add New Customer&quot; to add one.
                </td>
              </tr>
            )}
            {!isLoading && !error && customers.map((customer) => (
              <tr key={customer.id} className="border-b border-gray-200 hover:bg-gray-100">
                <td className="py-4 px-6 text-left whitespace-nowrap">{customer.name}</td>
                <td className="py-4 px-6 text-left">{customer.email}</td>
                <td className="py-4 px-6 text-left">{customer.phone}</td>
                <td className="py-4 px-6 text-left">{customer.address}</td>
                <td className="py-4 px-6 text-center whitespace-nowrap">
                  <button className="text-gray-600 hover:text-gray-800 mr-2 p-1" title="View Details">
                    <FiEye size={18} />
                  </button>
                  <button className="text-blue-600 hover:text-blue-800 mr-2 p-1" title="Edit Customer">
                    <FiEdit size={18} />
                  </button>
                  <button className="text-red-600 hover:text-red-800 p-1" title="Delete Customer">
                    <FiTrash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddNewCustomerModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveCustomer}      
      />
    </div>
  );
};

export default PosCustomerPage;
