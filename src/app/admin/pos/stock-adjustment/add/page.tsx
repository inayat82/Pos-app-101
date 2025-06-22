'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FiPlus, 
  FiSave, 
  FiArrowLeft, 
  FiPackage, 
  FiTrendingUp, 
  FiTrendingDown, 
  FiAlertCircle, 
  FiLoader, 
  FiTrash2,
  FiEdit3,
  FiCheck,
  FiX,
  FiDollarSign,
  FiHash,
  FiSearch
} from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  Timestamp, 
  doc, 
  updateDoc, 
  addDoc, 
  getDoc, 
  writeBatch,
  limit
} from 'firebase/firestore';
import { Product } from '@/types/pos';

interface AdjustmentItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productBarcode?: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  currentStock: number;
  adjustmentType: 'increase' | 'decrease' | '';
  adjustmentQuantity: number;
  newStock: number;
}

const AddStockAdjustmentPage = () => {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Set page title
  useEffect(() => {
    setPageTitle('Add Stock Adjustment');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Form state
  const [reason, setReason] = useState('');
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([]);
  const [notes, setNotes] = useState('');
  
  // Data states
  const [products, setProducts] = useState<Product[]>([]);
    // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50); // Show 50 products per page
  const [adjustmentId, setAdjustmentId] = useState<string>('');
  const [adjustmentDate] = useState(new Date());
    // Generate next adjustment ID
  const generateAdjustmentId = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      const adminId = currentUser.uid;
      const adjustmentsRef = collection(db, `admins/${adminId}/stock_adjustments`);
      const adjustmentsQuery = query(
        adjustmentsRef, 
        orderBy('adjustmentId', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(adjustmentsQuery);
      
      let nextNumber = 1;
      if (!snapshot.empty) {
        const lastAdjustment = snapshot.docs[0].data();
        const lastId = lastAdjustment.adjustmentId || 'AD00';
        const lastNumber = parseInt(lastId.replace('AD', '')) || 0;
        nextNumber = lastNumber + 1;
      }
      
      const newId = `AD${nextNumber.toString().padStart(2, '0')}`;
      setAdjustmentId(newId);
    } catch (error) {
      console.error('Error generating adjustment ID:', error);
      // Fallback to timestamp-based ID
      const fallbackId = `AD${Date.now().toString().slice(-4)}`;
      setAdjustmentId(fallbackId);
    }
  }, [currentUser?.uid]);

  // Fetch products
  const fetchData = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    const adminId = currentUser.uid;
    setIsLoadingData(true);
    
    try {
      // Fetch products
      const productsRef = collection(db, `admins/${adminId}/pos_products`);
      const productsQuery = query(productsRef, orderBy('name', 'asc'));
      const productsSnapshot = await getDocs(productsQuery);
      const productsList = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        adminId,
        ...doc.data(),
      })) as Product[];
      setProducts(productsList);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please refresh the page.');
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser?.uid]);
    useEffect(() => {
    fetchData();
    generateAdjustmentId();
  }, [fetchData, generateAdjustmentId]);

  // Add product to adjustment
  const addProductToAdjustment = (product: Product) => {
    // Check if product already exists
    const existingItem = adjustmentItems.find(item => item.productId === product.id);
    if (existingItem) {
      setError('Product already added to this adjustment');
      return;
    }
    
    const newItem: AdjustmentItem = {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      productBarcode: product.barcode,
      brandId: product.brandId,
      brandName: '', // Will be populated if needed
      categoryId: product.categoryId,
      categoryName: '', // Will be populated if needed
      currentStock: product.stockQty,
      adjustmentType: '',
      adjustmentQuantity: 1,
      newStock: product.stockQty,
    };
    
    setAdjustmentItems([...adjustmentItems, newItem]);
    setError(null);
  };
  
  // Update adjustment item
  const updateAdjustmentItem = (itemId: string, field: keyof AdjustmentItem, value: any) => {
    setAdjustmentItems(items => 
      items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          // Recalculate new stock
          if (field === 'adjustmentQuantity' || field === 'adjustmentType') {
            const qty = field === 'adjustmentQuantity' ? value : updatedItem.adjustmentQuantity;
            const type = field === 'adjustmentType' ? value : updatedItem.adjustmentType;
            if (type === 'increase') {
              updatedItem.newStock = updatedItem.currentStock + qty;
            } else if (type === 'decrease') {
              updatedItem.newStock = Math.max(0, updatedItem.currentStock - qty);
            } else {
              updatedItem.newStock = updatedItem.currentStock;
            }
          }
          return updatedItem;
        }
        return item;
      })
    );
  };
  
  // Remove adjustment item
  const removeAdjustmentItem = (itemId: string) => {
    setAdjustmentItems(items => items.filter(item => item.id !== itemId));
  };
  
  // Calculate totals
  const calculateTotals = () => {
    const totalItems = adjustmentItems.length;
    const totalIncreases = adjustmentItems.filter(item => item.adjustmentType === 'increase').reduce((sum, item) => sum + item.adjustmentQuantity, 0);
    const totalDecreases = adjustmentItems.filter(item => item.adjustmentType === 'decrease').reduce((sum, item) => sum + item.adjustmentQuantity, 0);
    
    return { totalItems, totalIncreases, totalDecreases };
  };
    // Filter and paginate products - only show results when user searches
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery || productSearchQuery.length < 2) return [];
    
    const searchTerm = productSearchQuery.toLowerCase();
    return products.filter(product => 
      product.name.toLowerCase().includes(searchTerm) ||
      product.sku.toLowerCase().includes(searchTerm) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm))
    );
  }, [products, productSearchQuery]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  
  // Form validation
  const validateForm = (): boolean => {
    setError(null);
    
    if (adjustmentItems.length === 0) {
      setError('Please add at least one product to the adjustment');
      return false;
    }

    if (!reason) {
      setError('Please select a reason for this adjustment');
      return false;
    }
    
    // Validate each item
    for (const item of adjustmentItems) {
      if (item.adjustmentQuantity <= 0) {
        setError(`Invalid adjustment quantity for ${item.productName}`);
        return false;
      }
      if (!item.adjustmentType) {
        setError(`Please select adjustment type for ${item.productName}`);
        return false;
      }
    }
    
    return true;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !currentUser?.uid) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const adminId = currentUser.uid;
      const batch = writeBatch(db);
      const { totalItems, totalIncreases, totalDecreases } = calculateTotals();
      
      // Create adjustment records and update product stock
      const adjustmentDate = Timestamp.now();
      
      for (const item of adjustmentItems) {        // Create adjustment record
        const adjustmentRef = doc(collection(db, `admins/${adminId}/stock_adjustments`));
        const adjustmentData = {
          adjustmentId: adjustmentId,
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          productBarcode: item.productBarcode || '',
          brandId: item.brandId || '',
          brandName: item.brandName || '',
          categoryId: item.categoryId || '',
          categoryName: item.categoryName || '',
          adjustmentType: item.adjustmentType,
          quantity: item.adjustmentQuantity,
          reason: reason,
          previousStock: item.currentStock,
          newStock: item.newStock,
          notes: notes,
          adminId: adminId,
          createdAt: adjustmentDate,
          createdBy: currentUser.email || 'Unknown User'
        };
        
        batch.set(adjustmentRef, adjustmentData);
        
        // Update product stock
        const productRef = doc(db, `admins/${adminId}/pos_products`, item.productId);
        batch.update(productRef, {
          stockQty: item.newStock,
          updatedAt: adjustmentDate
        });
      }
        // Commit all changes
      await batch.commit();
      
      setSuccess(`Stock adjustment ${adjustmentId} completed successfully! ${totalItems} products adjusted.`);
      
      // Reset form and generate new ID
      setAdjustmentItems([]);
      setNotes('');
      setReason('');
      generateAdjustmentId(); // Generate new ID for next adjustment
      
      // Redirect after success
      setTimeout(() => {
        router.push('/admin/pos/stock-adjustment');
      }, 2000);
      
    } catch (error) {
      console.error('Error processing stock adjustment:', error);
      setError('Failed to process stock adjustment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasonOptions = [
    'Stock Count Correction',
    'Damaged Goods',
    'Theft/Loss',
    'Expired Products',
    'Returned Items',
    'Supplier Error',
    'System Error',
    'Transfer In',
    'Transfer Out',
    'Other'
  ];
  if (isLoadingData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full">      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => router.push('/admin/pos/stock-adjustment')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Add Stock Adjustment</h1>
            <p className="text-gray-600 text-sm">Adjust inventory levels and track stock changes</p>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <FiAlertCircle className="text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <FiCheck className="text-green-500 mr-2" />
            <span className="text-green-700">{success}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">        {/* Header Section - Reason and Notes */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <FiTrendingUp className="text-blue-600 w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Adjustment Details</h2>
          </div>
          
          {/* Adjustment Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600">Adjustment ID:</span>
                <p className="text-sm font-bold text-blue-600">{adjustmentId || 'Generating...'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">User:</span>
                <p className="text-sm text-gray-800">{currentUser?.email || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Date:</span>
                <p className="text-sm text-gray-800">{adjustmentDate.toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Time:</span>
                <p className="text-sm text-gray-800">{adjustmentDate.toLocaleTimeString()}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Status:</span>
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">Draft</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Products:</span>
                <p className="text-sm text-gray-800">{adjustmentItems.length} items</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Reason for Adjustment *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                required
              >
                <option value="">Select Reason</option>
                {reasonOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional notes about this adjustment..."
              />
            </div>
          </div>
        </div>
        
        {/* Products Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <FiPackage className="text-green-600 w-5 h-5" />
              </div>              <h2 className="text-xl font-semibold text-gray-900">
                Search Products {filteredProducts.length > 0 && `(${filteredProducts.length} found)`}
              </h2>
            </div>
          </div>          {/* Search and Filter Bar */}
          <div className="mb-6">
            <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search products by name, SKU, or barcode... (minimum 2 characters)"
                    className="w-full px-4 py-4 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base shadow-sm"
                  />
                  <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
                <div className="text-sm text-gray-600 whitespace-nowrap font-medium">
                  {productSearchQuery.length >= 2 ? `${filteredProducts.length} found` : 'Type to search'}
                </div>
              </div>
              {productSearchQuery.length === 0 && (
                <p className="text-sm text-blue-700 mt-3 flex items-center">
                  <FiPackage className="w-4 h-4 mr-2" />
                  Start typing to search through your inventory and add products for stock adjustment
                </p>
              )}
            </div>
          </div>

          {/* Products List */}
          {paginatedProducts.length > 0 ? (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-gray-50 rounded-lg text-sm font-medium text-gray-700 border">
                <div className="col-span-4">Product</div>
                <div className="col-span-2">Current Stock</div>
                <div className="col-span-2">Action</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-1">New Stock</div>
                <div className="col-span-1">Add</div>
              </div>
              
              {/* Product Rows */}
              {paginatedProducts.map((product) => {
                const isAlreadyAdded = adjustmentItems.some(item => item.productId === product.id);
                
                return (
                  <div
                    key={product.id}
                    className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-lg transition-all ${
                      isAlreadyAdded 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{product.name}</h4>
                          <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                          {product.barcode && (
                            <p className="text-xs text-gray-500">Barcode: {product.barcode}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">Stock: {product.stockQty}</p>
                          <p className="text-xs text-gray-500">R{product.sellPrice.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      {!isAlreadyAdded && (
                        <button
                          type="button"
                          onClick={() => addProductToAdjustment(product)}
                          className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-colors"
                        >
                          <FiPlus className="w-4 h-4 mr-2" />
                          Add to Adjustment
                        </button>
                      )}
                      
                      {isAlreadyAdded && (
                        <div className="text-center py-2">
                          <span className="text-sm text-green-600 font-medium">✓ Added to adjustment</span>
                        </div>
                      )}
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden md:contents">
                      <div className="col-span-4">
                        <div>
                          <h4 className="font-medium text-gray-900 truncate">{product.name}</h4>
                          <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                          {product.barcode && (
                            <p className="text-xs text-gray-500">Barcode: {product.barcode}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <span className={`font-semibold ${product.stockQty <= 10 ? 'text-red-600' : 'text-green-600'}`}>
                          {product.stockQty}
                        </span>
                        <p className="text-xs text-gray-500">R{product.sellPrice.toFixed(2)}</p>
                      </div>
                      
                      <div className="col-span-2">
                        <span className="text-sm text-gray-500">Select after adding</span>
                      </div>
                      
                      <div className="col-span-2">
                        <span className="text-sm text-gray-500">Enter after adding</span>
                      </div>
                      
                      <div className="col-span-1">
                        <span className="text-sm text-gray-500">Auto-calc</span>
                      </div>
                      
                      <div className="col-span-1">
                        {!isAlreadyAdded ? (
                          <button
                            type="button"
                            onClick={() => addProductToAdjustment(product)}
                            className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                          >
                            <FiPlus className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 rounded-lg">
                            <FiCheck className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>          ) : (
            <div className="text-center py-12 text-gray-500">
              <FiSearch className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">
                {productSearchQuery.length === 0 ? 'Search for Products' : 
                 productSearchQuery.length < 2 ? 'Type at least 2 characters' : 'No products found'}
              </h3>
              <p className="text-sm">
                {productSearchQuery.length === 0 
                  ? 'Enter product name, SKU, or barcode to find products to adjust' 
                  : productSearchQuery.length < 2
                  ? 'Continue typing to search your inventory'
                  : `No products match "${productSearchQuery}". Try a different search term.`
                }
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} products
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Selected Products for Adjustment */}
        {adjustmentItems.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg mr-3">
                  <FiEdit3 className="text-orange-600 w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Products to Adjust ({adjustmentItems.length})
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {/* Table Header */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-gray-50 rounded-lg text-sm font-medium text-gray-700 border">
                <div className="col-span-4">Product</div>
                <div className="col-span-2">Current Stock</div>
                <div className="col-span-2">Action Type</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-1">New Stock</div>
                <div className="col-span-1">Remove</div>
              </div>
              
              {adjustmentItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border border-gray-200 rounded-lg bg-white"
                >
                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.productName}</h4>
                        <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
                        <p className="text-sm text-gray-600">Current Stock: {item.currentStock}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAdjustmentItem(item.id)}
                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
                        <select
                          value={item.adjustmentType}
                          onChange={(e) => updateAdjustmentItem(item.id, 'adjustmentType', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select</option>
                          <option value="increase">Increase</option>
                          <option value="decrease">Decrease</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={item.adjustmentQuantity}
                          onChange={(e) => updateAdjustmentItem(item.id, 'adjustmentQuantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">
                        New Stock: <span className={`${item.newStock < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {item.newStock}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:contents">
                    <div className="col-span-4">
                      <div>
                        <h4 className="font-medium text-gray-900 truncate">{item.productName}</h4>
                        <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
                      </div>
                    </div>
                    
                    <div className="col-span-2">
                      <span className="font-semibold text-gray-900">{item.currentStock}</span>
                    </div>
                    
                    <div className="col-span-2">
                      <select
                        value={item.adjustmentType}
                        onChange={(e) => updateAdjustmentItem(item.id, 'adjustmentType', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select Action</option>
                        <option value="increase">Increase</option>
                        <option value="decrease">Decrease</option>
                      </select>
                    </div>
                    
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.adjustmentQuantity}
                        onChange={(e) => updateAdjustmentItem(item.id, 'adjustmentQuantity', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    
                    <div className="col-span-1">
                      <span className={`font-semibold ${item.newStock < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.newStock}
                      </span>
                    </div>
                    
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => removeAdjustmentItem(item.id)}
                        className="flex items-center justify-center w-8 h-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {item.newStock < 0 && (
                    <div className="col-span-full mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center">
                        <FiAlertCircle className="text-red-500 mr-2 w-4 h-4" />
                        <span className="text-red-700 text-sm">
                          Warning: This adjustment will result in negative stock.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Section */}
        {adjustmentItems.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Adjustment Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{calculateTotals().totalItems}</div>
                <div className="text-sm text-blue-800">Products to Adjust</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">+{calculateTotals().totalIncreases}</div>
                <div className="text-sm text-green-800">Total Increases</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">-{calculateTotals().totalDecreases}</div>
                <div className="text-sm text-red-800">Total Decreases</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.push('/admin/pos/stock-adjustment')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm font-medium transition-colors"
          >
            Cancel
          </button>          <button
            type="submit"
            disabled={isSubmitting || adjustmentItems.length === 0}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting ? (
              <>
                <FiLoader className="animate-spin mr-2 w-4 h-4" />
                Processing {adjustmentId}...
              </>
            ) : (
              <>
                <FiSave className="mr-2 w-4 h-4" />
                Save Adjustment {adjustmentId} ({adjustmentItems.length} products)
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddStockAdjustmentPage;
