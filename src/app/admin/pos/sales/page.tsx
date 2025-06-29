'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit, FiEye, FiAlertCircle, FiShoppingBag, FiCalendar, FiUser, FiFileText, FiDollarSign } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { generateInvoicePDF } from '@/components/InvoiceComponent';
import POSLayout from '@/components/admin/POSLayout';

// Define the SaleItem type
interface SaleItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// Define the Sale type for individual sales
interface Sale {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerId: string;
  totalAmount: number;
  totalItems: number;
  totalQuantity: number;
  items: SaleItem[];
  paymentMethod: string;
  notes?: string;
  saleDate: any;
  createdAt: any;
  status: 'Completed' | 'Pending' | 'Cancelled';
}

const PosSalesPage = () => {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Set page title when component mounts
  useEffect(() => {
    setPageTitle('Sales Records');
    return () => setPageTitle(''); // Clean up on unmount
  }, [setPageTitle]);

  const [individualSales, setIndividualSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const recordOptions = [10, 25, 50, 100];
  // Load sales from Firestore
  useEffect(() => {
    const fetchSales = async () => {
      if (!currentUser?.uid) return;

      try {
        setIsLoading(true);
        const adminId = currentUser.uid;
        const salesRef = collection(db, `admins/${adminId}/pos_sales`);
        const q = query(salesRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        console.log('Sales query results:', querySnapshot.docs.length); // Debug log
          const salesList = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Sale document:', doc.id, data); // Debug log
          
          return {
            id: doc.id,
            invoiceNumber: data.invoiceNumber || `S${doc.id.slice(-2)}`,
            customerName: data.customerName || 'Walk-in Customer',
            customerId: data.customerId || 'walk-in',
            totalAmount: data.totalAmount || 0,
            totalItems: data.totalItems || 0,
            totalQuantity: data.totalQuantity || 0,
            items: data.items || [],
            paymentMethod: data.paymentMethod || 'Cash',
            notes: data.notes || '',
            saleDate: data.saleDate,
            createdAt: data.createdAt,
            status: 'Completed' as const,
          };
        }) as Sale[];
        
        // Filter out demo/test sales
        const filteredSalesList = salesList.filter(sale => {
          // Exclude sales with demo/test patterns
          const customerName = sale.customerName.toLowerCase();
          const invoiceNumber = sale.invoiceNumber.toLowerCase();
          
          const isDemoSale = 
            customerName.includes('demo') ||
            customerName.includes('test') ||
            customerName.includes('sample') ||
            invoiceNumber.includes('demo') ||
            invoiceNumber.includes('test') ||
            invoiceNumber.includes('sample') ||
            // Exclude any sales with the old complex invoice format (likely legacy/demo data)
            (invoiceNumber.includes('#') && invoiceNumber.includes('/'));
          
          return !isDemoSale;
        });
        
        setIndividualSales(filteredSalesList);
        setError(null);
      } catch (error: any) {
        console.error('Error fetching sales:', error);
        setError('Failed to load sales data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSales();
  }, [currentUser?.uid]);
  // Filter sales based on search term
  const filteredSales = individualSales.filter(sale => 
    sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.items.some(item => 
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productSku.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Calculate pagination
  const totalRecords = filteredSales.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentSales = filteredSales.slice(startIndex, endIndex);

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

  // Handle view sale details
  const handleViewSale = (sale: Sale) => {
    setSelectedSale(sale);
    setShowDetailsModal(true);
  };

  // Handle view invoice for a sale
  const handleViewInvoice = (sale: Sale) => {
    const invoiceData = {
      id: sale.id,
      type: 'sale' as const,
      customerName: sale.customerName,
      invoiceNumber: sale.invoiceNumber,
      date: sale.saleDate?.toDate?.()?.toLocaleDateString() || new Date().toLocaleDateString(),
      items: sale.items.map(item => ({
        productName: item.productName,
        sku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      totalAmount: sale.totalAmount,
      paymentMethod: sale.paymentMethod,
      notes: sale.notes || '',
    };

    generateInvoicePDF(invoiceData);
  };

  // Handle edit sale
  const handleEditSale = (sale: Sale) => {
    // For now, redirect to add sale page with pre-filled info
    // In a full implementation, you'd pass the sale data to edit
    router.push(`/admin/pos/sales/add?edit=${sale.id}&customer=${encodeURIComponent(sale.customerName)}`);
  };

  const handleAddNewSale = () => {
    router.push('/admin/pos/sales/add');
  };  return (
    <POSLayout
      pageTitle="Sales Records"
      pageDescription="View individual sales transactions and manage customer orders."
      breadcrumbs={[
        { label: 'POS System' },
        { label: 'Sales Records' }
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiShoppingBag className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Total Sales</div>
                <div className="text-2xl font-bold text-slate-900">{totalRecords}</div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiDollarSign className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Total Revenue</div>
                <div className="text-2xl font-bold text-slate-900">
                  R{filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiSearch className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Filtered Results</div>
                <div className="text-2xl font-bold text-slate-900">{filteredSales.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-slate-200">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="flex items-center flex-1 w-full">
              <FiSearch className="text-slate-500 mr-3" />
              <input
                type="text"
                placeholder="Search by invoice number, customer name, or product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            
            <div className="flex items-center gap-4">
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
                onClick={handleAddNewSale}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
              >
                <FiPlus className="mr-2" size={16} /> New Sale
              </button>
            </div>
          </div>
          
          {totalRecords > 0 && (
            <div className="mt-3 text-xs text-slate-500">
              Showing {startIndex + 1}-{Math.min(endIndex, totalRecords)} of {totalRecords} sales
            </div>
          )}
        </div>        <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-slate-200">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <FiShoppingBag className="animate-spin text-3xl text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-700 mb-2">Loading sales data...</h3>
                <p className="text-slate-500">Fetching transaction records</p>
              </div>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                <FiShoppingBag className="text-4xl text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">No Sales Records Found</h3>
              <p className="text-lg text-slate-600 mb-6 max-w-md mx-auto">
                {searchTerm ? 'No results match your search criteria.' : 'Start by recording your first sale transaction.'}
              </p>
              {!searchTerm && (
                <button
                  onClick={handleAddNewSale}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Record First Sale
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Sales Records ({currentSales.length})
                    </h2>
                    <p className="text-slate-600 text-sm mt-1">
                      Individual transaction records and customer orders
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-200">
                {currentSales.map((sale) => (
                  <div key={sale.id} className="p-6 hover:bg-blue-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 border border-blue-200">
                          <FiShoppingBag className="text-blue-600" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-slate-900">
                              {sale.invoiceNumber}
                            </h3>
                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                              {sale.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                            <span className="flex items-center">
                              <FiUser className="mr-1" size={14} />
                              {sale.customerName}
                            </span>
                            <span className="flex items-center">
                              <FiShoppingBag className="mr-1" size={14} />
                              {sale.totalItems} items
                            </span>
                            <span className="flex items-center">
                              <FiCalendar className="mr-1" size={14} />
                              {sale.saleDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                            </span>
                            <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm">
                              {sale.paymentMethod}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 ml-4">
                        <button
                          onClick={() => handleViewSale(sale)}
                          className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-lg font-medium flex items-center gap-2 transition-colors"
                          title="View Details"
                        >
                          <FiEye size={14} />
                          Details
                        </button>
                        
                        <button
                          onClick={() => handleViewInvoice(sale)}
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium flex items-center gap-2 transition-colors"
                          title="View Invoice"
                        >
                          <FiFileText size={14} />
                          Invoice
                        </button>
                        
                        <button
                          onClick={() => handleEditSale(sale)}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium flex items-center gap-2 transition-colors"
                          title="Edit Sale"
                        >
                          <FiEdit size={14} />
                          Edit
                        </button>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-xl font-bold text-slate-900">
                          R{sale.totalAmount.toFixed(2)}
                        </div>
                        <div className="text-sm text-slate-500">Total</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {startIndex + 1}-{Math.min(endIndex, totalRecords)} of {totalRecords} sales
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
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
                  className="px-3 py-2 text-sm bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sale Details Modal */}
        {showDetailsModal && selectedSale && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-96 overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Sale Details - {selectedSale.invoiceNumber}</h3>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-xl"
                  >
                    ×
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Invoice Number</label>
                    <p className="font-medium text-slate-800">{selectedSale.invoiceNumber}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Customer</label>
                    <p className="font-medium text-slate-800">{selectedSale.customerName}</p>
                  </div>
                  <label className="block text-sm text-gray-600 mb-1">Sale Date</label>
                  <p className="font-medium text-gray-800">
                    {selectedSale.saleDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Payment Method</label>
                  <p className="font-medium text-gray-800">{selectedSale.paymentMethod}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Total Items</label>
                  <p className="font-medium text-gray-800">{selectedSale.totalItems} items</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Total Amount</label>
                  <p className="font-medium text-gray-800">R{selectedSale.totalAmount.toFixed(2)}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Items Sold</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-50 rounded-lg">
                    <thead>
                      <tr className="text-xs text-gray-600 uppercase tracking-wider">
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Unit Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedSale.items.map((item, index) => (
                        <tr key={index} className="text-sm">
                          <td className="px-3 py-2">{item.productName}</td>
                          <td className="px-3 py-2">{item.productSku || 'N/A'}</td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">R{item.unitPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">R{item.totalPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedSale.notes && (
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 mb-1">Notes</label>
                  <p className="font-medium text-gray-800">{selectedSale.notes}</p>
                </div>
              )}
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleViewInvoice(selectedSale);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  View Invoice
                </button>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleEditSale(selectedSale);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Edit Sale
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </POSLayout>
  );
};

export default PosSalesPage;
