// Placeholder for ViewUserModal.tsx
import React from 'react';
import { UserProfile } from '@/types/user';
import { FiX, FiEdit } from 'react-icons/fi'; // Added FiEdit

interface ViewUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onEditUser: (user: UserProfile) => void; // Added prop for edit action
}

const ViewUserModal: React.FC<ViewUserModalProps> = ({ isOpen, onClose, user, onEditUser }) => {
  if (!isOpen || !user) return null;

  const DetailItem: React.FC<{ label: string; value: any }> = ({ label, value }) => (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 break-words">
        {value || 'N/A'}
      </dd>
    </div>
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      // Check if it's a Firebase Timestamp object
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
      }
      // Check if it's a string or number that can be parsed by Date
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
    } catch (e) {
      console.error("Error formatting date:", e);
    }
    return 'Invalid Date';
  };

  const handleEditClick = () => {
    if (user) {
      onEditUser(user);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full flex justify-center items-center p-4">
      <div className="relative bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 ease-out scale-95 hover:scale-100">
        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800">User Details</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
            aria-label="Close modal"
          >
            <FiX size={24} />
          </button>
        </div>
        
        <div className="mt-6">
          <dl className="divide-y divide-gray-200">
            <DetailItem label="Full Name" value={user.name || user.displayName} />
            {user.username && <DetailItem label="Username" value={`@${user.username}`} />}
            <DetailItem label="Email" value={user.email} />
            <DetailItem label="Role" value={user.role} />
            <DetailItem label="User ID (UID)" value={user.uid} />
            <DetailItem label="Phone Number" value={user.phone} />
            <DetailItem label="Account Created" value={formatDate(user.createdAt)} />
            <DetailItem label="Last Updated" value={formatDate(user.updatedAt)} />
          </dl>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end space-x-3">
          <button 
            onClick={handleEditClick} 
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150 flex items-center"
          >
            <FiEdit className="mr-2" size={18}/> Edit Details
          </button>
          <button 
            onClick={onClose} 
            className="px-6 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors duration-150"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewUserModal;
