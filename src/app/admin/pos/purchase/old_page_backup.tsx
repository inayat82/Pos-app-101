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
        
        console.log('Purchases query results:', querySnapshot.docs.length); // Debug log
        
        const purchasesList = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Purchase document:', doc.id, data); // Debug log
          
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
          // Exclude purchases with demo/test patterns
          const supplierName = purchase.supplierName.toLowerCase();
          const invoiceNumber = purchase.invoiceNumber.toLowerCase();
          
          const isDemoPurchase = 
            supplierName.includes('demo') ||
            supplierName.includes('test') ||
            supplierName.includes('sample') ||
            invoiceNumber.includes('demo') ||
            invoiceNumber.includes('test') ||
            invoiceNumber.includes('sample') ||
            // Exclude any purchases with the old complex invoice format (likely legacy/demo data)
            (invoiceNumber.includes('#') && invoiceNumber.includes('/'));
          
          return !isDemoPurchase;
        });
        
        setIndividualPurchases(filteredPurchasesList);
        setError(null);
      } catch (error: any) {
        console.error('Error fetching purchases:', error);
        setError('Failed to load purchase data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPurchases();
  }, [currentUser?.uid]);
  // Filter purchases based on search term
  const filteredPurchases = individualPurchases.filter(purchase => 
    purchase.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.items.some(item => 
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productSku.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Calculate pagination
  const totalRecords = filteredPurchases.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentPurchases = filteredPurchases.slice(startIndex, endIndex);

  // Handle page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle records per page change
  const handleRecordsPerPageChange = (newRecordsPerPage: number) => {
    setRecordsPerPage(newRecordsPerPage);
    setCurrentPage(1); // Reset to first page when changing records per page
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
    // For now, redirect to add purchase page with pre-filled info
    // In a full implementation, you'd pass the purchase data to edit
    router.push(`/admin/pos/purchase/add?edit=${purchase.id}&supplier=${encodeURIComponent(purchase.supplierName)}`);
  };

  const handleAddNewPurchase = () => {
    router.push('/admin/pos/purchase/add');
  };  return (
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

                    {/* Items Preview */}
                    <div className="mt-2 text-xs text-gray-500">
                      <span className="font-medium">Items: </span>
                      {purchase.items.slice(0, 3).map((item, index) => (
                        <span key={index}>
                          {item.productName} (×{item.quantity})
                          {index < Math.min(purchase.items.length, 3) - 1 ? ', ' : ''}
                        </span>
                      ))}
                      {purchase.items.length > 3 && (
                        <span className="text-blue-600 font-medium"> +{purchase.items.length - 3} more</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Amount and Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-800">
                        R{purchase.totalAmount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600">Total Amount</div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* View Details Button */}
                      <button
                        onClick={() => handleViewPurchase(purchase)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                        title="View Details"
                      >
                        <FiEye className="h-3 w-3" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                      
                      {/* View Invoice Button */}
                      <button
                        onClick={() => handleViewInvoice(purchase)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                        title="View Invoice"
                      >
                        <FiFileText className="h-3 w-3" />
                        <span className="hidden sm:inline">Invoice</span>
                      </button>
                      
                      {/* Edit Button */}
                      <button
                        onClick={() => handleEditPurchase(purchase)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                        title="Edit Purchase"
                      >
                        <FiEdit className="h-3 w-3" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>        )}
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, totalRecords)} of {totalRecords} purchases
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-600 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 text-sm rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-600 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
        
      <div className="mt-4 flex justify-between items-center text-xs text-gray-600">
        <p>Showing individual purchase records with unique invoice numbers.</p>
        <p>{filteredPurchases.length} purchase{filteredPurchases.length !== 1 ? 's' : ''} found</p>
      </div>{/* Purchase Details Modal */}
      {showDetailsModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Purchase Details</h3>
                  <p className="text-sm text-gray-600">Invoice: {selectedPurchase.invoiceNumber}</p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Supplier Name</label>
                  <p className="font-medium text-gray-800">{selectedPurchase.supplierName}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Purchase Date</label>
                  <p className="font-medium text-gray-800">
                    {selectedPurchase.purchaseDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Invoice Number</label>
                  <p className="font-medium text-gray-800">{selectedPurchase.invoiceNumber}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Total Amount</label>
                  <p className="font-medium text-gray-800">R{selectedPurchase.totalAmount.toFixed(2)}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Total Items</label>
                  <p className="font-medium text-gray-800">{selectedPurchase.totalItems} items</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Total Quantity</label>
                  <p className="font-medium text-gray-800">{selectedPurchase.totalQuantity} units</p>
                </div>
              </div>

              {selectedPurchase.notes && (
                <div className="mb-6">
                  <label className="block text-sm text-gray-600 mb-1">Notes</label>
                  <p className="font-medium text-gray-800 bg-gray-50 p-3 rounded-lg">{selectedPurchase.notes}</p>
                </div>
              )}
              
              <div className="mb-4">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Purchase Items</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-50 rounded-lg">
                    <thead className="bg-gray-100">
                      <tr className="text-xs text-gray-600 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Product</th>
                        <th className="px-4 py-3 text-left">SKU</th>
                        <th className="px-4 py-3 text-center">Quantity</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedPurchase.items.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-100">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                            <div className="text-xs text-gray-500">ID: {item.productId}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.productSku || 'N/A'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center h-6 w-8 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900">R{item.purchasePrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">R{item.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
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
