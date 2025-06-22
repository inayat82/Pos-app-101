import React, { useState, useEffect, FormEvent } from 'react';
import { FiX, FiSave, FiTruck, FiAlertCircle } from 'react-icons/fi';

// Updated SupplierFormData interface
export interface SupplierFormData {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  companyName?: string;
  vatNumber?: string;
  notes?: string;
}

interface AddNewSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplierData: SupplierFormData) => Promise<void>; // Changed to Promise<void>
  error?: string | null; // Added error prop
  isLoading?: boolean; // Added isLoading prop
}

const AddNewSupplierModal: React.FC<AddNewSupplierModalProps> = ({
  isOpen,
  onClose,
  onSave,
  error: initialError, // Use prop for initial error
  isLoading: isSaving, // Use prop for loading state
}) => {
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    companyName: '',
    vatNumber: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal is opened
      setFormData({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        companyName: '',
        vatNumber: '',
        notes: '',
      });
      setFormError(null); // Clear previous form errors
    }
  }, [isOpen]);

  // Update formError if initialError prop changes
  useEffect(() => {
    setFormError(initialError || null);
  }, [initialError]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormError(null); // Clear error on new input
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Supplier name is required.');
      return;
    }
    setFormError(null); // Clear local error before save attempt

    const dataToSave: SupplierFormData = {
      name: formData.name.trim(),
      contactPerson: formData.contactPerson.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      companyName: formData.companyName?.trim() || undefined,
      vatNumber: formData.vatNumber?.trim() || undefined,
      notes: formData.notes?.trim() || undefined,
    };

    try {
      await onSave(dataToSave);
      // onClose(); // Let parent handle closing on successful save
    } catch (err) {
      // Error is usually handled by the parent and passed via props
      // If not, set a generic error here
      if (!initialError) { // Avoid overwriting specific error from parent
         setFormError('Failed to save supplier. Please try again.');
      }
      console.error("Error in modal handleSubmit:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-4">
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <FiTruck className="text-xl text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Add New Supplier</h3>
          </div>
          <button onClick={onClose} disabled={isSaving} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <FiX size={20} />
          </button>
        </div>

        {formError && (
          <div className="m-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md flex items-center">
            <FiAlertCircle className="mr-2 h-5 w-5" />
            <span>{formError}</span>
          </div>
        )}
        {initialError && !formError && ( // Display error from parent if no local form error
          <div className="m-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md flex items-center">
            <FiAlertCircle className="mr-2 h-5 w-5" />
            <span>{initialError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[calc(80vh-100px)] overflow-y-auto"> {/* Adjusted max-height */}
            {/* Row 1: Supplier Name & Contact Person */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Global Office Supplies"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  id="contactPerson"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  placeholder="e.g., John Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Row 2: Email & Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g., contact@globalsupplies.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g., +1-555-123-4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Row 3: Address (Full Width) */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                id="address"
                name="address"
                rows={3}
                value={formData.address}
                onChange={handleChange}
                placeholder="e.g., 123 Supply Chain St, Business City, TX 75001"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Row 4: Company Name & VAT Number (Optional) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name (Optional)
                </label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="If different from supplier name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="vatNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  VAT Number (Optional)
                </label>
                <input
                  type="text"
                  id="vatNumber"
                  name="vatNumber"
                  value={formData.vatNumber}
                  onChange={handleChange}
                  placeholder="e.g., GB123456789"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Row 5: Notes (Full Width, Optional) */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any additional information about the supplier"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end p-4 border-t space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !formData.name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
            >
              <FiSave className="mr-2" />
              {isSaving ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNewSupplierModal;
