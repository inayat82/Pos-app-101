'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiPlus, 
  FiSave, 
  FiArrowLeft, 
  FiPackage, 
  FiShoppingCart, 
  FiAlertCircle, 
  FiLoader, 
  FiTrash2,
  FiEdit3,
  FiCheck,
  FiX,
  FiDollarSign,
  FiHash,
  FiUser,
  FiCreditCard
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
  setDoc
} from 'firebase/firestore';
import { Product } from '@/types/pos';

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productBarcode?: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  sellPrice: number;
  quantity: number;
  totalAmount: number;
  currentStockQty: number;
}

const AddSalePage = () => {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Set page title
  useEffect(() => {
    setPageTitle('Add Sale');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Form state
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Transfer'>('Cash');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [notes, setNotes] = useState('');
    // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  
  // Fetch products and customers
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
      setFilteredProducts(productsList);
      
      // Fetch customers
      const customersRef = collection(db, `admins/${adminId}/customers`);
      const customersQuery = query(customersRef, orderBy('name', 'asc'));
      const customersSnapshot = await getDocs(customersQuery);
      const customersList = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        adminId,
        ...doc.data(),
      }));
      
      setCustomers(customersList);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter products based on search
  useEffect(() => {
    if (!productSearchQuery.trim()) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        (product.barcode && product.barcode.toLowerCase().includes(productSearchQuery.toLowerCase()))
      );
      setFilteredProducts(filtered);
    }
  }, [productSearchQuery, products]);
  // Add product to sale
  const handleAddProduct = (product: Product, closeModal: boolean = true) => {
    if (product.stockQty <= 0) {
      setError(`${product.name} is out of stock`);
      return;
    }

    const existingItem = saleItems.find(item => item.productId === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stockQty) {
        setError(`Cannot add more ${product.name}. Only ${product.stockQty} in stock`);
        return;
      }
      updateSaleItem(existingItem.id, 'quantity', existingItem.quantity + 1);
    } else {
      const newItem: SaleItem = {
        id: Date.now().toString(),
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productBarcode: product.barcode,
        sellPrice: product.sellPrice,
        quantity: 1,
        totalAmount: product.sellPrice,
        currentStockQty: product.stockQty,
      };
      setSaleItems([...saleItems, newItem]);
    }
    
    if (closeModal) {
      setShowProductSearch(false);
    }
    setError(null);
  };

  // Update sale item
  const updateSaleItem = (itemId: string, field: string, value: number) => {
    setSaleItems(items => 
      items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'sellPrice') {
            updatedItem.totalAmount = updatedItem.quantity * updatedItem.sellPrice;
          }
          
          // Check stock limit
          if (field === 'quantity' && value > item.currentStockQty) {
            setError(`Only ${item.currentStockQty} ${item.productName} available in stock`);
            return item;
          }
          
          return updatedItem;
        }
        return item;
      })
    );
  };

  // Remove sale item
  const removeSaleItem = (itemId: string) => {
    setSaleItems(items => items.filter(item => item.id !== itemId));
  };

  // Calculate totals
  const calculateTotals = () => {
    const totalItems = saleItems.length;
    const totalQuantity = saleItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = saleItems.reduce((sum, item) => sum + item.totalAmount, 0);
    return { totalItems, totalQuantity, totalAmount };
  };  // Generate invoice number
  const generateInvoiceNumber = async (type: 'sale' | 'purchase') => {
    const adminId = currentUser?.uid;
    if (!adminId) return null;

    try {
      // Get the counter collection for this admin
      const counterRef = doc(db, `admins/${adminId}/counters`, type);
      const counterDoc = await getDoc(counterRef);
      
      let nextNumber = 1;
      if (counterDoc.exists()) {
        nextNumber = (counterDoc.data().count || 0) + 1;
      }
      
      // Update the counter (create if doesn't exist)
      await setDoc(counterRef, { 
        count: nextNumber,
        updatedAt: Timestamp.now() 
      }, { merge: true });
      
      // Generate simplified invoice number format: S01, S02, P01, P02, etc.
      const prefix = type === 'sale' ? 'S' : 'P';
      const invoiceNumber = `${prefix}${nextNumber.toString().padStart(2, '0')}`;
      
      return invoiceNumber;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      // Fallback to timestamp-based number
      const timestamp = Date.now().toString().slice(-4);
      const prefix = type === 'sale' ? 'S' : 'P';
      return `${prefix}${timestamp}`;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submitted!'); // Debug log
    console.log('Current user:', currentUser?.uid); // Debug log
    console.log('Sale items:', saleItems); // Debug log
    
    if (!currentUser?.uid) {
      setError('Authentication required. Please log in again.');
      return;
    }
    
    if (saleItems.length === 0) {
      setError('Please add at least one product to the sale');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      const adminId = currentUser.uid;
      const batch = writeBatch(db);
      const { totalQuantity, totalAmount } = calculateTotals();
        console.log('Creating sale with data:', { adminId, totalQuantity, totalAmount }); // Debug log
      
      // Generate unique invoice number
      const invoiceNumber = await generateInvoiceNumber('sale');
      if (!invoiceNumber) {
        throw new Error('Failed to generate invoice number');
      }
      
      // Create sale record with unique ID and invoice number
      const saleData = {
        adminId,
        customerName: customerName.trim(),
        customerId: `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique customer reference for this sale
        invoiceNumber,
        paymentMethod,
        items: saleItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          sellPrice: item.sellPrice,
          quantity: item.quantity,
          totalAmount: item.totalAmount,
        })),
        totalItems: saleItems.length,
        totalQuantity,
        totalAmount,        notes: notes.trim(),
        saleDate: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const salesRef = collection(db, `admins/${adminId}/pos_sales`);
      const saleDocRef = doc(salesRef);
      batch.set(saleDocRef, saleData);

      // Update product stock quantities
      for (const item of saleItems) {
        const productRef = doc(db, `admins/${adminId}/pos_products`, item.productId);
        const newStockQty = item.currentStockQty - item.quantity;
        batch.update(productRef, {
          stockQty: newStockQty,
          updatedAt: Timestamp.now(),
        });
      }      await batch.commit();
        console.log('Sale committed successfully!'); // Debug log
      setSuccess(`Sale completed successfully! Invoice: ${invoiceNumber} | Total: R${totalAmount.toFixed(2)}`);
      
      // Reset form for new sale
      setSaleItems([]);
      setCustomerName('Walk-in Customer');
      setPaymentMethod('Cash');
      setNotes('');
      setError(null);
      
      // Wait a moment to show success message, then redirect
      setTimeout(() => {
        router.push('/admin/pos/sales');
      }, 2000);
        } catch (error: any) {
      console.error('Error processing sale:', error);
      console.error('Error details:', error.message, error.code); // Enhanced debug log
      setError(error.message || 'Failed to process sale. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const { totalItems, totalQuantity, totalAmount } = calculateTotals();
  
  return (
    <div className="w-full max-w-full">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all duration-200 text-sm font-medium border border-gray-300 hover:border-gray-400"
            >
              <FiArrowLeft className="mr-2 w-4 h-4" />
              Back to Sales
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add Sale</h1>
              <p className="text-sm text-gray-600">Process customer purchases and update inventory</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              New Sale
            </div>
          </div>
        </div>
      </div>
      
      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start">
          <FiCheck className="text-green-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-green-800">Success!</h3>
            <p className="text-green-700 text-sm mt-1">{success}</p>
          </div>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start">
          <FiAlertCircle className="text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoadingData && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center">
          <FiLoader className="animate-spin text-blue-600 mr-3 flex-shrink-0" />
          <div>
            <p className="text-blue-700 text-sm font-medium">Loading products...</p>
            <p className="text-blue-600 text-xs">Please wait while we fetch available products</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Row 1: Sale Details */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Customer Details */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <FiUser className="text-blue-600 w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Customer Details</h2>
            </div>
            
            <div className="space-y-4">              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name
                </label>
                <select
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Walk-in Customer">Walk-in Customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.name}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {customers.length === 0 && !isLoadingData && (
                  <div className="text-sm text-gray-500 mt-1">
                    No customers found. 
                    <a 
                      href="/admin/pos/customer" 
                      target="_blank"
                      className="text-blue-600 hover:text-blue-800 ml-1 underline"
                    >
                      Add customers here
                    </a>
                  </div>
                )}
                {isLoadingData && (
                  <p className="text-sm text-gray-500 mt-1">Loading customers...</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'Card' | 'Transfer')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Transfer">Bank Transfer</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional notes about this sale..."
                />
              </div>
            </div>
          </div>

          {/* Sale Summary Preview */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl border border-green-200">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <FiShoppingCart className="text-green-600 w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Sale Summary</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">{totalItems}</div>
                  <div className="text-xs font-medium text-gray-600">Products</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-green-600">{totalQuantity}</div>
                  <div className="text-xs font-medium text-gray-600">Quantity</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-purple-600">R{totalAmount.toFixed(2)}</div>
                  <div className="text-xs font-medium text-gray-600">Total</div>
                </div>
              </div>
              
              <div className="p-4 bg-white rounded-lg border-l-4 border-green-500">
                <p className="text-sm text-gray-600">
                  <strong>Customer:</strong> {customerName}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Payment:</strong> {paymentMethod}
                </p>
              </div>
            </div>
          </div>
        </div>        {/* Row 2: Products */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <FiPackage className="text-green-600 w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Products</h2>
            </div>
          </div>

          {/* Search Box */}
          <div className="mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="Search products by name, SKU, or barcode..."
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base"
                />
                <FiPackage className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowProductSearch(true)}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm font-medium transition-colors whitespace-nowrap"
              >
                <FiPlus className="mr-2 w-4 h-4" />
                Add Product
              </button>
            </div>
            
            {/* Search Results Preview */}
            {productSearchQuery && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm text-gray-600 mb-3">
                  Found {filteredProducts.filter(p => p.stockQty > 0).length} products matching "{productSearchQuery}" • Showing only products with stock
                </p>
                {filteredProducts.filter(p => p.stockQty > 0).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredProducts.filter(p => p.stockQty > 0).slice(0, 6).map((product) => {
                      const isAlreadyAdded = saleItems.some(item => item.productId === product.id);
                      const addedItem = saleItems.find(item => item.productId === product.id);
                      const availableStock = product.stockQty - (addedItem?.quantity || 0);
                      return (
                        <div
                          key={product.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            availableStock <= 0 || isAlreadyAdded 
                              ? 'bg-gray-100 border-gray-300 opacity-75' 
                              : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-sm'
                          }`}
                          onClick={() => availableStock > 0 && !isAlreadyAdded && handleAddProduct(product, false)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">{product.name}</h4>
                              <p className="text-xs text-gray-600">SKU: {product.sku}</p>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-green-600 font-medium">R{product.sellPrice.toFixed(2)}</p>
                                <p className="text-xs text-gray-500">Stock: {availableStock}</p>
                              </div>
                            </div>
                            {!isAlreadyAdded && availableStock > 0 ? (                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddProduct(product, false);
                                }}
                                className="ml-2 p-1 text-green-600 hover:bg-green-100 rounded"
                              >
                                <FiPlus className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="ml-2 text-xs text-green-600 font-medium">
                                {isAlreadyAdded ? `Added: ${addedItem?.quantity}` : 'No Stock'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {filteredProducts.filter(p => p.stockQty > 0).length > 6 && (
                      <div className="col-span-full text-center py-2">
                        <button
                          onClick={() => setShowProductSearch(true)}
                          className="text-sm text-green-600 hover:text-green-700 font-medium"
                        >
                          View all {filteredProducts.filter(p => p.stockQty > 0).length} results...
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {filteredProducts.filter(p => p.stockQty > 0).length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <FiPackage className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No products with stock found for "{productSearchQuery}"</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product Search Modal */}
          {showProductSearch && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-900">Add Products to Sale</h3>
                    <button
                      onClick={() => setShowProductSearch(false)}
                      className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <FiX className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="mt-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        placeholder="Search by product name, SKU, or barcode..."
                        className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg"
                        autoFocus
                      />
                      <FiPackage className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Found {filteredProducts.length} products • Showing only products with stock
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 200px)' }}>
                  {filteredProducts.filter(p => p.stockQty > 0).length > 0 ? (
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredProducts.filter(p => p.stockQty > 0).map((product) => {
                          const isAlreadyAdded = saleItems.some(item => item.productId === product.id);
                          const addedItem = saleItems.find(item => item.productId === product.id);
                          const availableStock = product.stockQty - (addedItem?.quantity || 0);
                          
                          return (
                            <div
                              key={product.id}
                              className={`border rounded-xl p-4 transition-all hover:shadow-md ${
                                availableStock <= 0
                                  ? 'bg-gray-50 border-gray-200 opacity-75' 
                                  : 'bg-white border-gray-200 hover:border-green-300 cursor-pointer'
                              }`}
                              onClick={() => availableStock > 0 && handleAddProduct(product)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <h4 className="font-medium text-gray-900">{product.name}</h4>
                                    {isAlreadyAdded && (
                                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                        In Cart: {addedItem?.quantity}
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-1 text-sm text-gray-600">
                                    <p><span className="font-medium">SKU:</span> {product.sku}</p>
                                    {product.barcode && (
                                      <p><span className="font-medium">Barcode:</span> {product.barcode}</p>
                                    )}
                                    <div className="flex items-center space-x-4 mt-2">
                                      <p><span className="font-medium">Available:</span> 
                                        <span className={`ml-1 font-semibold ${availableStock <= 5 ? 'text-orange-600' : 'text-green-600'}`}>
                                          {availableStock}
                                        </span>
                                      </p>
                                      <p><span className="font-medium">Price:</span> 
                                        <span className="ml-1 font-semibold text-green-600">R{product.sellPrice.toFixed(2)}</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                {availableStock > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddProduct(product);
                                    }}
                                    className="ml-4 flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium transition-colors"
                                  >
                                    <FiPlus className="w-4 h-4 mr-1" />
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <FiPackage className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium mb-2">No products available</p>
                      <p className="text-sm">All products are out of stock or no products match your search</p>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      {filteredProducts.filter(p => p.stockQty > 0).length} products available
                    </p>
                    <button
                      onClick={() => setShowProductSearch(false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm font-medium transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Sale Items List */}
          {saleItems.length > 0 ? (
            <div className="space-y-4">
              {saleItems.map((item, index) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <FiShoppingCart className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{item.productName}</h4>
                          <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        {item.productBarcode && (
                          <p><span className="font-medium">Barcode:</span> {item.productBarcode}</p>
                        )}
                        <p><span className="font-medium">Available Stock:</span> 
                          <span className={`ml-1 font-semibold ${item.currentStockQty <= 10 ? 'text-orange-600' : 'text-green-600'}`}>
                            {item.currentStockQty}
                          </span>
                        </p>
                        <p><span className="font-medium">Unit Price:</span> 
                          <span className="ml-1 font-semibold text-green-600">R{item.sellPrice.toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSaleItem(item.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title="Remove item"
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FiHash className="inline w-4 h-4 mr-1" />
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={item.currentStockQty}
                        value={item.quantity}
                        onChange={(e) => updateSaleItem(item.id, 'quantity', Number(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-medium"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Max: {item.currentStockQty} available
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Stock Level
                      </label>
                      <div className="px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <span className="text-lg font-bold text-orange-700">
                          {item.currentStockQty - item.quantity}
                        </span>
                        <span className="text-sm text-orange-600 ml-1">
                          (-{item.quantity})
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Total Amount
                      </label>
                      <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                        <span className="text-lg font-bold text-green-700">
                          R{item.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Totals Summary */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl border-2 border-green-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <FiDollarSign className="mr-2 text-green-600" />
                  Sale Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                    <div className="text-3xl font-bold text-blue-600 mb-1">{totalItems}</div>
                    <div className="text-sm font-medium text-gray-600">Products</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                    <div className="text-3xl font-bold text-green-600 mb-1">{totalQuantity}</div>
                    <div className="text-sm font-medium text-gray-600">Total Quantity</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                    <div className="text-3xl font-bold text-purple-600 mb-1">R{totalAmount.toFixed(2)}</div>
                    <div className="text-sm font-medium text-gray-600">Total Amount</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <FiShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products added yet</h3>
              <p className="text-sm text-gray-600 mb-4">Click "Add Product" to start building your sale</p>
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-xl">
          <div className="flex items-center text-sm text-gray-600">
            <span className="font-medium">*Required fields</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting || saleItems.length === 0}
              className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {isSubmitting ? (
                <>
                  <FiLoader className="animate-spin mr-2 w-4 h-4" />
                  Processing Sale...
                </>
              ) : (
                <>
                  <FiSave className="mr-2 w-4 h-4" />
                  Complete Sale • R{totalAmount.toFixed(2)}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddSalePage;
