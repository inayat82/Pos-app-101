'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit, FiEye, FiAlertCircle, FiPackage, FiCalendar, FiFileText, FiTruck } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { generateInvoicePDF } from '@/components/InvoiceComponent';
import POSLayout from '@/components/admin/POSLayout';

// Define the PurchaseItem type
interface PurchaseItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  purchasePrice: number;
  totalAmount: number;
}

// Define the Purchase type for individual purchases
interface Purchase {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  supplierId: string;
  totalAmount: number;
  totalItems: number;
  totalQuantity: number;
  items: PurchaseItem[];
  notes?: string;
  purchaseDate: any;
  createdAt: any;
  status: 'Received' | 'Pending' | 'Cancelled';
}

const PosPurchasePage = () => {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Set page title when component mounts
  useEffect(() => {
    setPageTitle('Purchase Records');
    return () => setPageTitle(''); // Clean up on unmount
  }, [setPageTitle]);

  const [individualPurchases, setIndividualPurchases] = useState<Purchase[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const recordOptions = [10, 25, 50, 100];

  // Load purchases from Firestore
  useEffect(() => {
    const fetchPurchases = async () => {
      if (!currentUser?.uid) return;

      try {
        setIsLoading(true);
        const adminId = currentUser.uid;
        const purchasesRef = collection(db, `admins/${adminId}/pos_purchases`);
        const q = query(purchasesRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const purchasesList = querySnapshot.docs.map(doc => {
          const data = doc.data();
          
          return {
            id: doc.id,
            invoiceNumber: data.invoiceNumber || `P${doc.id.slice(-2)}`,
            supplierName: data.supplierName || 'Unknown Supplier',
            supplierId: data.supplierId || 'unknown',
            totalAmount: data.totalAmount || 0,
            totalItems: data.totalItems || 0,
            totalQuantity: data.totalQuantity || 0,
            items: data.items || [],
            notes: data.notes || '',
            purchaseDate: data.purchaseDate,
            createdAt: data.createdAt,
            status: 'Received' as const,
          };
        }) as Purchase[];
        
        // Filter out demo/test purchases
        const filteredPurchasesList = purchasesList.filter(purchase => {
          const supplierName = purchase.supplierName.toLowerCase();
          const invoiceNumber = purchase.invoiceNumber.toLowerCase();
          
          return !supplierName.includes('demo') && 
                 !supplierName.includes('test') && 
                 !invoiceNumber.includes('demo') && 
                 !invoiceNumber.includes('test');
        });
        
        setIndividualPurchases(filteredPurchasesList);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching purchases:", err);
        setError("Failed to load purchase records. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPurchases();
  }, [currentUser]);

  // Filter purchases based on search term
  const filteredPurchases = individualPurchases.filter(purchase => {
    if (!searchTerm) return true;
    
    const searchTermLower = searchTerm.toLowerCase();
    const itemNames = purchase.items.map(item => item.productName.toLowerCase()).join(' ');
    
    return (
      purchase.supplierName.toLowerCase().includes(searchTermLower) ||
      purchase.invoiceNumber.toLowerCase().includes(searchTermLower) ||
      itemNames.includes(searchTermLower)
    );
  });

  // Pagination calculations
  const totalRecords = filteredPurchases.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentPurchases = filteredPurchases.slice(startIndex, endIndex);

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleRecordsPerPageChange = (newRecordsPerPage: number) => {
    setRecordsPerPage(newRecordsPerPage);
    setCurrentPage(1);
  };

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Handle view purchase details
  const handleViewPurchase = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setShowDetailsModal(true);
  };

  // Handle view details (same as handleViewPurchase for consistency)
  const handleViewDetails = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setShowDetailsModal(true);
  };

  // Handle view invoice for a purchase
  const handleViewInvoice = (purchase: Purchase) => {
    const invoiceData = {
      id: purchase.id,
      type: 'purchase' as const,
      supplierName: purchase.supplierName,
      invoiceNumber: purchase.invoiceNumber,
      date: purchase.purchaseDate?.toDate?.()?.toLocaleDateString() || new Date().toLocaleDateString(),
      items: purchase.items.map(item => ({
        productName: item.productName,
        sku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.purchasePrice,
        totalPrice: item.totalAmount,
      })),
      totalAmount: purchase.totalAmount,
      notes: purchase.notes || '',
    };

    generateInvoicePDF(invoiceData);
  };

  // Handle edit purchase
  const handleEditPurchase = (purchase: Purchase) => {
    router.push(`/admin/pos/purchase/add?edit=${purchase.id}&supplier=${encodeURIComponent(purchase.supplierName)}`);
  };

  const handleAddNewPurchase = () => {
    router.push('/admin/pos/purchase/add');
  };

  return (
    <POSLayout
      pageTitle="Purchase Records"
      pageDescription="View individual purchase records with invoice numbers and manage your order history."
      breadcrumbs={[
        { label: 'Purchase System' },
        { label: 'Purchase Records' }
      ]}
    >
      <div className="p-6">
        {/* Error message */}
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
            <FiPackage className="text-blue-600 text-xl mr-3" />
            <div>
              <div className="text-sm text-slate-600">Total Records</div>
              <div className="text-2xl font-bold text-slate-900">{totalRecords}</div>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center flex-1 w-full sm:w-auto">
              <FiSearch className="text-slate-500 mr-3 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by supplier, invoice number, or product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            
            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
              {/* Records per page selector */}
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Show:</span>
                <select
                  value={recordsPerPage}
                  onChange={(e) => handleRecordsPerPageChange(Number(e.target.value))}
                  className="border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {recordOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <span>per page</span>
              </div>
              
              <button
                onClick={handleAddNewPurchase}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center text-sm"
              >
                <FiPlus className="mr-2" size={16} /> Add Purchase
              </button>
            </div>
          </div>
          
          {/* Results summary */}
          {totalRecords > 0 && (
            <div className="mt-3 text-xs text-slate-500">
              Showing {startIndex + 1}-{Math.min(endIndex, totalRecords)} of {totalRecords} purchases
            </div>
          )}
        </div>

        {/* Main Content Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
          {/* Table Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Purchase Records ({totalRecords})
                </h2>
                <p className="text-slate-600 text-sm mt-1">
                  Complete history of all purchase transactions
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
                <h3 className="text-xl font-semibold text-slate-700 mb-2">Loading purchase records...</h3>
                <p className="text-slate-500">Please wait while we fetch your data</p>
              </div>
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                <FiPackage className="text-4xl text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">
                {searchTerm ? 'No Results Found' : 'No Purchase Records'}
              </h3>
              <p className="text-lg text-slate-600 mb-6 max-w-md mx-auto">
                {searchTerm 
                  ? 'No results match your search criteria. Try adjusting your search terms.'
                  : 'Start by adding your first purchase record to track your inventory purchases.'
                }
              </p>
              {!searchTerm && (
                <button
                  onClick={handleAddNewPurchase}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Add Your First Purchase
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {currentPurchases.map((purchase) => (
                <div key={purchase.id} className="p-6 hover:bg-blue-50 transition-colors duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {/* Purchase Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {purchase.invoiceNumber}
                        </div>
                        <div className="text-sm text-slate-500 flex items-center">
                          <FiCalendar className="h-3 w-3 mr-1" />
                          {purchase.purchaseDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-slate-900 truncate mb-1">
                        <FiTruck className="inline h-4 w-4 mr-2 text-slate-600" />
                        {purchase.supplierName}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <span className="flex items-center">
                          <FiPackage className="h-3 w-3 mr-1" />
                          {purchase.totalItems} items ({purchase.totalQuantity} qty)
                        </span>
                      </div>

                      {purchase.notes && (
                        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{purchase.notes}</p>
                      )}
                    </div>

                    {/* Purchase Amount and Actions */}
                    <div className="flex flex-col sm:items-end gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-slate-900">R{purchase.totalAmount.toFixed(2)}</div>
                        <div className="text-sm text-slate-500">Total Amount</div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetails(purchase)}
                          className="px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors text-sm font-medium"
                          title="View Details"
                        >
                          <FiEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditPurchase(purchase)}
                          className="px-3 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors text-sm font-medium"
                          title="Edit Purchase"
                        >
                          <FiEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewInvoice(purchase)}
                          className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors text-sm font-medium"
                          title="View Invoice"
                        >
                          <FiFileText className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Purchase Details Modal */}
        {showDetailsModal && selectedPurchase && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b border-slate-200">
                <h3 className="text-xl font-semibold text-slate-900">Purchase Details - {selectedPurchase.invoiceNumber}</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Supplier Name</label>
                    <p className="font-medium text-slate-800">{selectedPurchase.supplierName}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Purchase Date</label>
                    <p className="font-medium text-slate-800">
                      {selectedPurchase.purchaseDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Invoice Number</label>
                    <p className="font-medium text-slate-800">{selectedPurchase.invoiceNumber}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Total Amount</label>
                    <p className="font-medium text-slate-800">R{selectedPurchase.totalAmount.toFixed(2)}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Total Items</label>
                    <p className="font-medium text-slate-800">{selectedPurchase.totalItems} items</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Total Quantity</label>
                    <p className="font-medium text-slate-800">{selectedPurchase.totalQuantity} units</p>
                  </div>
                </div>

                {selectedPurchase.notes && (
                  <div className="mb-6">
                    <label className="block text-sm text-slate-600 mb-1">Notes</label>
                    <p className="font-medium text-slate-800 bg-slate-50 p-3 rounded-lg">{selectedPurchase.notes}</p>
                  </div>
                )}
                
                <div className="mb-4">
                  <h4 className="text-md font-semibold text-slate-800 mb-3">Purchase Items</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-slate-50 rounded-lg">
                      <thead className="bg-slate-100">
                        <tr className="text-xs text-slate-600 uppercase tracking-wider">
                          <th className="px-4 py-3 text-left">Product</th>
                          <th className="px-4 py-3 text-left">SKU</th>
                          <th className="px-4 py-3 text-center">Quantity</th>
                          <th className="px-4 py-3 text-right">Unit Price</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedPurchase.items.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-100">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-slate-900">{item.productName}</div>
                              <div className="text-xs text-slate-500">ID: {item.productId}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{item.productSku || 'N/A'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center justify-center h-6 w-8 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                {item.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-slate-900">R{item.purchasePrice.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">R{item.totalAmount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      handleViewInvoice(selectedPurchase);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-1"
                  >
                    <FiFileText className="h-4 w-4" />
                    <span>View Invoice</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleEditPurchase(selectedPurchase);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-1"
                  >
                    <FiEdit className="h-4 w-4" />
                    <span>Edit Purchase</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </POSLayout>
  );
};

export default PosPurchasePage;
