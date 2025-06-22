'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiEye, FiAlertCircle } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// Define the Stock Adjustment type for records page
interface StockAdjustmentItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  adjustmentType: 'increase' | 'decrease';
  reason: string;
  previousStock: number;
  newStock: number;
}

interface StockAdjustment {
  id: string;
  adjustmentId: string;
  date: string;
  adjustedBy: string;
  products: StockAdjustmentItem[];  
  totalItems: number;
  status: 'Completed' | 'Pending' | 'Cancelled';
  notes?: string;
  createdAt?: any;
  reason: string;
}

const StockAdjustmentPage = () => {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Set page title when component mounts
  useEffect(() => {
    setPageTitle('Stock Adjustments');
    return () => setPageTitle(''); // Clean up on unmount
  }, [setPageTitle]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustment | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  // Load stock adjustments from Firestore
  useEffect(() => {
    const fetchAdjustments = async () => {
      if (!currentUser?.uid) return;

      try {
        setIsLoading(true);
        const adminId = currentUser.uid;
        const adjustmentsRef = collection(db, `admins/${adminId}/stock_adjustments`);
        const q = query(adjustmentsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        // Group adjustments by adjustmentId
        const adjustmentGroups: { [key: string]: any[] } = {};
        
        querySnapshot.docs.forEach(doc => {
          const data = doc.data();
          const adjustmentId = data.adjustmentId || doc.id;
          
          if (!adjustmentGroups[adjustmentId]) {
            adjustmentGroups[adjustmentId] = [];
          }
          
          adjustmentGroups[adjustmentId].push({
            id: doc.id,
            ...data
          });
        });
        
        // Convert grouped data to StockAdjustment objects
        const adjustmentsList = Object.entries(adjustmentGroups).map(([adjustmentId, items]) => {
          const firstItem = items[0];
          const products = items.map(item => ({
            productId: item.productId || '',
            productName: item.productName || 'Unknown Product',
            sku: item.productSku || '',
            quantity: item.quantity || 0,
            adjustmentType: item.adjustmentType || 'increase',
            reason: item.reason || 'No reason provided',
            previousStock: item.previousStock || 0,
            newStock: item.newStock || 0,
          }));
          
          return {
            id: adjustmentId,
            adjustmentId: adjustmentId,
            date: firstItem.createdAt?.toDate?.()?.toLocaleDateString() || new Date().toLocaleDateString(),
            adjustedBy: firstItem.createdBy || 'System',
            totalItems: products.length,
            status: 'Completed' as const,
            products: products,
            notes: firstItem.notes || '',
            reason: firstItem.reason || 'No reason provided',
            createdAt: firstItem.createdAt
          };
        });
        
        // Sort by creation date (newest first)
        adjustmentsList.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setAdjustments(adjustmentsList);
        setError(null);
      } catch (error: any) {
        console.error('Error fetching adjustments:', error);
        setError('Failed to load adjustment data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdjustments();
  }, [currentUser?.uid]);  const handleAddNewAdjustment = () => {
    router.push('/admin/pos/stock-adjustment/add');
  };

  // Handle edit adjustment
  const handleEditAdjustment = (adjustment: StockAdjustment) => {
    router.push(`/admin/pos/stock-adjustment/add?edit=${adjustment.id}`);
  };

  // Handle view adjustment details
  const handleViewAdjustment = (adjustment: StockAdjustment) => {
    setSelectedAdjustment(adjustment);
    setShowDetailsModal(true);
  };
  // Filter adjustments based on search term
  const filteredAdjustments = adjustments.filter(adjustment => 
    adjustment.adjustmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adjustment.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adjustment.products.some(product => 
      product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Pagination calculations
  const totalRecords = filteredAdjustments.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = filteredAdjustments.slice(startIndex, endIndex);

  // Update current page when records per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [recordsPerPage, searchTerm]);

  return (
    <div className="w-full max-w-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Stock Adjustments</h1>
          <p className="text-gray-600 text-sm">Manage inventory adjustments and track stock changes.</p>
        </div>
        <button
          onClick={handleAddNewAdjustment}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center text-sm"
        >
          <FiPlus className="mr-2" /> Add New Adjustment
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4 rounded-md shadow" role="alert">
          <div className="flex">
            <div className="py-1"><FiAlertCircle className="h-5 w-5 text-red-500 mr-3" /></div>
            <div>
              <p className="font-bold text-sm">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}      {/* Search bar and Records per page selector */}
      <div className="mb-4 bg-white p-3 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center flex-grow">
            <FiSearch className="text-gray-500 mr-3 h-4 w-4" />
            <input
              type="text"
              placeholder="Search adjustments by ID, product, or reason..."
              className="flex-grow p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Show:</label>
            <select
              value={recordsPerPage}
              onChange={(e) => setRecordsPerPage(Number(e.target.value))}
              className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600 whitespace-nowrap">records</span>
          </div>
        </div>
      </div>{/* Adjustments table */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-xs leading-normal">
              <th className="py-3 px-4 text-left">Adjustment ID</th>
              <th className="py-3 px-4 text-left">Date</th>
              <th className="py-3 px-4 text-left">Adjusted By</th>
              <th className="py-3 px-4 text-left">Reason</th>
              <th className="py-3 px-4 text-left">Total Items</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-xs">            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  Loading adjustment data...
                </td>
              </tr>
            ) : currentRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No adjustments found matching your search.' : 'No adjustment records available yet. Click "Add New Adjustment" to record one.'}
                </td>
              </tr>
            ) : (
              currentRecords.map((adjustment) => (
                <tr key={adjustment.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 text-left whitespace-nowrap">
                    <span className="font-semibold text-blue-600">{adjustment.adjustmentId}</span>
                  </td>
                  <td className="py-3 px-4 text-left whitespace-nowrap">{adjustment.date}</td>
                  <td className="py-3 px-4 text-left">{adjustment.adjustedBy}</td>
                  <td className="py-3 px-4 text-left">{adjustment.reason}</td>
                  <td className="py-3 px-4 text-left">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                      {adjustment.totalItems} {adjustment.totalItems === 1 ? 'item' : 'items'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-left">
                    <span className="px-2 py-1 font-semibold leading-tight text-xs rounded-full bg-green-100 text-green-800">
                      {adjustment.status}
                    </span>
                  </td>                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button 
                      onClick={() => handleViewAdjustment(adjustment)}
                      className="text-blue-600 hover:text-blue-800 mr-2 p-1" 
                      title="View Details"
                    >
                      <FiEye size={16} />
                    </button>
                    <button 
                      onClick={() => handleEditAdjustment(adjustment)}
                      className="text-green-600 hover:text-green-800 mr-2 p-1" 
                      title="Edit Adjustment"
                    >
                      <FiEdit size={16} />
                    </button>
                    <button className="text-red-600 hover:text-red-800 p-1" title="Delete Adjustment">
                      <FiTrash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination and status */}
      {!isLoading && currentRecords.length > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-b-lg shadow-sm">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, totalRecords)}</span> of{' '}
                <span className="font-medium">{totalRecords}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === 1 || page === totalPages || 
                           (page >= currentPage - 2 && page <= currentPage + 2);
                  })
                  .map((page, index, array) => (
                    <React.Fragment key={page}>
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          ...
                        </span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 mt-3">Stock adjustment records are fetched from Firestore. Product stock is updated upon adjustment.</p>
      
      {/* Adjustment Details Modal */}
      {showDetailsModal && selectedAdjustment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Adjustment Details - {selectedAdjustment.adjustmentId}</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Adjustment ID</label>
                  <p className="font-medium text-gray-800">{selectedAdjustment.adjustmentId}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Date</label>
                  <p className="font-medium text-gray-800">{selectedAdjustment.date}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Adjusted By</label>
                  <p className="font-medium text-gray-800">{selectedAdjustment.adjustedBy}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Reason</label>
                  <p className="font-medium text-gray-800">{selectedAdjustment.reason}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Total Items</label>
                  <p className="font-medium text-gray-800">{selectedAdjustment.totalItems} products adjusted</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Status</label>
                  <span className="px-2 py-1 font-semibold leading-tight text-xs rounded-full bg-green-100 text-green-800">
                    {selectedAdjustment.status}
                  </span>
                </div>
              </div>

              {/* Products Table */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Adjusted Products</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-50 rounded-lg">
                    <thead>
                      <tr className="text-xs text-gray-600 uppercase tracking-wider">
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-center">Type</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Previous Stock</th>
                        <th className="px-3 py-2 text-right">New Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedAdjustment.products.map((product, index) => (
                        <tr key={index} className="text-sm">
                          <td className="px-3 py-2">{product.productName}</td>
                          <td className="px-3 py-2">{product.sku || 'N/A'}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              product.adjustmentType === 'increase' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {product.adjustmentType === 'increase' ? 'Increase' : 'Decrease'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">{product.quantity}</td>
                          <td className="px-3 py-2 text-right">{product.previousStock}</td>
                          <td className="px-3 py-2 text-right">{product.newStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedAdjustment.notes && (
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 mb-1">Notes</label>
                  <p className="font-medium text-gray-800">{selectedAdjustment.notes}</p>
                </div>
              )}
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockAdjustmentPage;
