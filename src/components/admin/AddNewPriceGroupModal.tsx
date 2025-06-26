
import React, { useState } from 'react';
import { FiX, FiSave, FiTag } from 'react-icons/fi';

interface AddNewPriceGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (priceGroupData: any) => void; // Replace 'any' with a proper type later
}

const AddNewPriceGroupModal: React.FC<AddNewPriceGroupModalProps> = ({ isOpen, onClose, onSave }) => {
  // All hooks must be called at the top level
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');

  // Early return after hooks
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation (can be expanded)
    if (!groupName.trim() || !discountPercentage.trim()) {
      alert('Group Name and Discount Percentage are required.');
      return;
    }
    onSave({ 
      groupName,
      description,
      discountPercentage 
    });
    // Reset form and close
    setGroupName('');
    setDescription('');
    setDiscountPercentage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <FiTag className="text-xl text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Add New Price Group</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="groupName"
                name="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                placeholder="Enter group name (e.g., Wholesale, VIP)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the price group"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="discountPercentage" className="block text-sm font-medium text-gray-700 mb-1">
                Discount % <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="discountPercentage"
                name="discountPercentage"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(e.target.value)}
                required
                placeholder="Enter discount percentage (e.g., 10 for 10%)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
            >
              <FiSave className="mr-2" /> Save Price Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNewPriceGroupModal;
