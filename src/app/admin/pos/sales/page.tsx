'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit, FiEye, FiAlertCircle, FiShoppingBag, FiCalendar, FiUser, FiFileText } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { generateInvoicePDF } from '@/components/InvoiceComponent';

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
    <div className="w-full max-w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Sales Records</h1>
          <p className="text-gray-600 text-sm">View individual sales transactions.</p>
        </div>
        <button
          onClick={handleAddNewSale}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center justify-center text-sm w-full sm:w-auto"
        >
          <FiPlus className="mr-2" /> Add New Sale
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
      )}      
        {/* Search and Controls */}
      <div className="mb-4 bg-white p-3 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center flex-1 w-full sm:w-auto">
            <FiSearch className="text-gray-500 mr-3 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by invoice number, customer name, or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          
          {/* Records per page selector */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Show:</span>
            <select
              value={recordsPerPage}
              onChange={(e) => handleRecordsPerPageChange(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {recordOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <span>per page</span>
          </div>
        </div>
        
        {/* Results summary */}
        {totalRecords > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            Showing {startIndex + 1}-{Math.min(endIndex, totalRecords)} of {totalRecords} sales
          </div>
        )}
      </div>      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            Loading sales data...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiShoppingBag className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">No Sales Records Found</p>
            <p className="text-sm">
              {searchTerm ? 'No results match your search criteria.' : 'No sales records available yet.'}
            </p>
            {!searchTerm && (
              <button
                onClick={handleAddNewSale}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Record Your First Sale
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {currentSales.map((sale) => (
              <div key={sale.id} className="p-4 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 md:space-x-4 flex-1">
                    <div className="h-8 w-8 md:h-10 md:w-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FiShoppingBag className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base md:text-lg font-semibold text-gray-800 truncate">
                          {sale.invoiceNumber}
                        </h3>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                          {sale.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-600">
                        <span className="flex items-center">
                          <FiUser className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                          {sale.customerName}
                        </span>
                        <span className="flex items-center">
                          <FiShoppingBag className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                          {sale.totalItems} items
                        </span>
                        <span className="flex items-center">
                          <FiCalendar className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                          {sale.saleDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </span>
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs hidden sm:inline-block">
                          {sale.paymentMethod}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    {/* View Details Button */}
                    <button
                      onClick={() => handleViewSale(sale)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                      title="View Details"
                    >
                      <FiEye className="h-3 w-3" />
                      <span className="hidden sm:inline">Details</span>
                    </button>
                    
                    {/* Invoice Button */}
                    <button
                      onClick={() => handleViewInvoice(sale)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                      title="View Invoice"
                    >
                      <FiFileText className="h-3 w-3" />
                      <span className="hidden sm:inline">Invoice</span>
                    </button>
                    
                    {/* Edit Button */}
                    <button
                      onClick={() => handleEditSale(sale)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                      title="Edit Sale"
                    >
                      <FiEdit className="h-3 w-3" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-lg md:text-xl font-bold text-gray-800">
                      R{sale.totalAmount.toFixed(2)}
                    </div>
                    <div className="text-xs md:text-sm text-gray-600 hidden sm:block">Total</div>
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
            Showing {startIndex + 1}-{Math.min(endIndex, totalRecords)} of {totalRecords} sales
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
        <p>Individual sales records are displayed with their unique invoice numbers.</p>
        <p>{filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''} found</p>
      </div>{/* Sale Details Modal */}
      {showDetailsModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Sale Details - {selectedSale.invoiceNumber}</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Invoice Number</label>
                  <p className="font-medium text-gray-800">{selectedSale.invoiceNumber}</p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Customer</label>
                  <p className="font-medium text-gray-800">{selectedSale.customerName}</p>
                </div>
                
                <div>
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
        </div>
      )}
    </div>
  );
};

export default PosSalesPage;
