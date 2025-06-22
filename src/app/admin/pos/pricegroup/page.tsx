// filepath: c:\Users\USER-PC\My Drive\Sync App\Ai\Project\app-101\pos-app\src\app\admin\pos\pricegroup\page.tsx
import React from 'react';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';

const PosPriceGroupPage = () => {
  // Dummy data for demonstration
  const priceGroups = [
    {
      id: '1',
      groupName: 'Wholesale Tier 1',
      description: 'For large volume buyers',
      discountPercentage: '15%',
      active: true,
    },
    {
      id: '2',
      groupName: 'Seasonal Sale',
      description: 'Limited time promotion',
      discountPercentage: '10%',
      active: false,
    },
  ];

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Price Groups</h1>
        <p className="text-gray-600">Manage your product price groups and rules here.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg shadow-sm mb-8">
        <h2 className="text-xl font-semibold text-blue-700 mb-2">Price Group Configuration</h2>
        <p className="text-blue-600 mb-4">
          Define different pricing tiers or groups for various customer segments or sales channels.
        </p>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center">
          <FiPlus className="mr-2" /> Add New Price Group
        </button>
      </div>

      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
              <th className="py-3 px-6 text-left">Group Name</th>
              <th className="py-3 px-6 text-left">Description</th>
              <th className="py-3 px-6 text-left">Discount %</th>
              <th className="py-3 px-6 text-left">Active</th>
              <th className="py-3 px-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {priceGroups.map((group) => (
              <tr key={group.id} className="border-b border-gray-200 hover:bg-gray-100">
                <td className="py-4 px-6 text-left whitespace-nowrap">{group.groupName}</td>
                <td className="py-4 px-6 text-left">{group.description}</td>
                <td className="py-4 px-6 text-left">{group.discountPercentage}</td>
                <td className="py-4 px-6 text-left">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      group.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {group.active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="py-4 px-6 text-center whitespace-nowrap">
                  <button className="text-blue-600 hover:text-blue-800 mr-2 p-1 font-medium">Edit</button>
                  <button className="text-red-600 hover:text-red-800 p-1 font-medium">Delete</button>
                </td>
              </tr>
            ))}
            {priceGroups.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500">
                  No price groups found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-600 mt-4">Price group data would be stored in Firestore.</p>
    </div>
  );
};

export default PosPriceGroupPage;
