'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiPlus, 
  FiSave, 
  FiArrowLeft, 
  FiPackage, 
  FiTruck, 
  FiAlertCircle, 
  FiLoader, 
  FiTrash2,
  FiEdit3,
  FiCheck,
  FiX,
  FiDollarSign,
  FiHash
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
import { Brand, Category, Supplier, Product } from '@/types/pos';

interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productBarcode?: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  currentPurchasePrice: number;
  newPurchasePrice: number;
  quantity: number;
  totalAmount: number;
  currentStockQty: number;
}

const AddPurchasePage = () => {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Set page title
  useEffect(() => {
    setPageTitle('Add Purchase');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Form state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>('');
  const [status, setStatus] = useState<'pending' | 'received'>('received');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [notes, setNotes] = useState('');
  
  // Data states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  
  // Fetch suppliers, products, brands, and categories
  const fetchData = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    const adminId = currentUser.uid;
    setIsLoadingData(true);
    
    try {
      // Fetch suppliers
      const suppliersRef = collection(db, `admins/${adminId}/suppliers`);
      const suppliersQuery = query(suppliersRef, orderBy('name', 'asc'));
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersList = suppliersSnapshot.docs.map(doc => ({
        id: doc.id,
        adminId,
        ...doc.data(),
      })) as Supplier[];
      setSuppliers(suppliersList);
      
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
      
      // Fetch brands
      const brandsRef = collection(db, `admins/${adminId}/brands`);
      const brandsQuery = query(brandsRef, orderBy('name', 'asc'));
      const brandsSnapshot = await getDocs(brandsQuery);
      const brandsList = brandsSnapshot.docs.map(doc => ({
        id: doc.id,
        adminId,
        ...doc.data(),
      })) as Brand[];
      setBrands(brandsList);
      
      // Fetch categories
      const categoriesRef = collection(db, `admins/${adminId}/categories`);
      const categoriesQuery = query(categoriesRef, orderBy('name', 'asc'));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesList = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        adminId,
        ...doc.data(),
      })) as Category[];
      setCategories(categoriesList);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please refresh the page.');
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser?.uid]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Handle supplier selection
  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    const supplier = suppliers.find(s => s.id === supplierId);
    setSelectedSupplierName(supplier?.name || '');
  };    // Add product to purchase
  const addProductToPurchase = (product: Product, closeModal: boolean = true) => {
    // Check if product already exists
    const existingItem = purchaseItems.find(item => item.productId === product.id);
    if (existingItem) {
      setError('Product already added to this purchase');
      return;
    }
    
    const brand = brands.find(b => b.id === product.brandId);
    const category = categories.find(c => c.id === product.categoryId);
    
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      productBarcode: product.barcode,
      brandId: product.brandId,
      brandName: brand?.name,
      categoryId: product.categoryId,
      categoryName: category?.name,
      currentPurchasePrice: product.purchasePrice,
      newPurchasePrice: product.purchasePrice,
      quantity: 1,
      totalAmount: product.purchasePrice,
      currentStockQty: product.stockQty
    };
    
    setPurchaseItems([...purchaseItems, newItem]);
    if (closeModal) {
      setShowProductSearch(false);
      setProductSearchQuery('');
    }
    setError(null);
  };

  // Handle add product (alias for addProductToPurchase)
  const handleAddProduct = addProductToPurchase;
  
  // Update purchase item
  const updatePurchaseItem = (itemId: string, field: keyof PurchaseItem, value: any) => {
    setPurchaseItems(items => 
      items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          // Recalculate total amount
          if (field === 'quantity' || field === 'newPurchasePrice') {
            updatedItem.totalAmount = updatedItem.quantity * updatedItem.newPurchasePrice;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };
  
  // Remove purchase item
  const removePurchaseItem = (itemId: string) => {
    setPurchaseItems(items => items.filter(item => item.id !== itemId));
  };
  
  // Calculate totals
  const calculateTotals = () => {
    const totalItems = purchaseItems.length;
    const totalQuantity = purchaseItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = purchaseItems.reduce((sum, item) => sum + item.totalAmount, 0);
    
    return { totalItems, totalQuantity, totalAmount };
  };
  
  // Filter products for search
  const filteredProducts = products.filter(product => {
    const searchTerm = productSearchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchTerm) ||
      product.sku.toLowerCase().includes(searchTerm) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm))
    );
  });
  
  // Form validation
  const validateForm = (): boolean => {
    setError(null);
    
    if (!selectedSupplierId) {
      setError('Please select a supplier');
      return false;
    }
    
    if (purchaseItems.length === 0) {
      setError('Please add at least one product to the purchase');
      return false;
    }
    
    // Validate each item
    for (const item of purchaseItems) {
      if (item.quantity <= 0) {
        setError(`Invalid quantity for ${item.productName}`);
        return false;
      }
      if (item.newPurchasePrice <= 0) {
        setError(`Invalid purchase price for ${item.productName}`);
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
      
      // Create single purchase record with items array
      const purchaseDate = Timestamp.now();
      const receivedDate = status === 'received' ? purchaseDate : null;
        // Calculate totals
      const totalQuantity = purchaseItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = purchaseItems.reduce((sum, item) => sum + item.totalAmount, 0);
      
      // Generate unique invoice number
      const invoiceNumber = await generateInvoiceNumber('purchase');
      if (!invoiceNumber) {
        throw new Error('Failed to generate invoice number');
      }
      
      // Create purchase document structure similar to sales
      const purchaseData = {
        supplierId: selectedSupplierId,
        supplierName: selectedSupplierName,
        adminId,
        invoiceNumber,
        items: purchaseItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          productBarcode: item.productBarcode || '',
          brandId: item.brandId || '',
          brandName: item.brandName || '',
          categoryId: item.categoryId || '',
          categoryName: item.categoryName || '',
          purchasePrice: item.newPurchasePrice,
          quantity: item.quantity,
          totalAmount: item.totalAmount,
        })),
        totalItems: purchaseItems.length,
        totalQuantity,
        totalAmount,
        notes: notes.trim(),
        status,
        purchaseDate,
        receivedDate,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const purchasesRef = collection(db, `admins/${adminId}/pos_purchases`);
      const purchaseDocRef = doc(purchasesRef);
      batch.set(purchaseDocRef, purchaseData);

      // Update product stock quantities for each item
      for (const item of purchaseItems) {
        const productRef = doc(db, `admins/${adminId}/pos_products`, item.productId);
        const newStockQty = item.currentStockQty + item.quantity;
        const productUpdateData: any = {
          stockQty: newStockQty,
          updatedAt: Timestamp.now()
        };
        
        // Update purchase price if it changed
        if (item.newPurchasePrice !== item.currentPurchasePrice) {
          productUpdateData.purchasePrice = item.newPurchasePrice;
        }
        
        batch.update(productRef, productUpdateData);
      }
      
      // Commit all changes
      await batch.commit();
        console.log('Purchase committed successfully!'); // Debug log
      setSuccess(`Purchase added successfully! Invoice: ${invoiceNumber} | ${purchaseItems.length} products, ${totalQuantity} items, R${totalAmount.toFixed(2)} total`);
      
      // Reset form for new purchase
      setPurchaseItems([]);
      setSelectedSupplierId('');
      setSelectedSupplierName('');
      setStatus('received');
      setNotes('');
      setError(null);
      
      // Wait a moment to show success message, then redirect
      setTimeout(() => {
        router.push('/admin/pos/purchase');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error adding purchase:', error);
      setError(error.message || 'Failed to add purchase. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
    // Generate invoice number
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
              Back to Purchases
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add Purchase</h1>
              <p className="text-sm text-gray-600">Record new stock purchases and update inventory</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              Draft
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
            <p className="text-blue-700 text-sm font-medium">Loading data...</p>
            <p className="text-blue-600 text-xs">Please wait while we fetch suppliers and products</p>
          </div>
        </div>
      )}
      
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Purchase Details */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <FiTruck className="text-blue-600 w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Purchase Details</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Supplier *
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                required
              >
                <option value="">Select Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'pending' | 'received')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="received">Received</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes about this purchase..."
            />
          </div>
        </div>
        
        {/* Products Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <FiPackage className="text-green-600 w-5 h-5" />
              </div>              <h2 className="text-xl font-semibold text-gray-900">Products</h2>
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
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                />
                <FiPackage className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowProductSearch(true)}
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium transition-colors whitespace-nowrap"
              >
                <FiPlus className="mr-2 w-4 h-4" />
                Add Product
              </button>
            </div>
            
            {/* Search Results Preview */}
            {productSearchQuery && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm text-gray-600 mb-3">
                  Found {filteredProducts.length} products matching "{productSearchQuery}"
                </p>
                {filteredProducts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredProducts.slice(0, 6).map((product) => {
                      const isAlreadyAdded = purchaseItems.some(item => item.productId === product.id);
                      return (
                        <div
                          key={product.id}                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            isAlreadyAdded 
                              ? 'bg-gray-100 border-gray-300 opacity-75' 
                              : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                          }`}
                          onClick={() => !isAlreadyAdded && handleAddProduct(product, false)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">{product.name}</h4>
                              <p className="text-xs text-gray-600">SKU: {product.sku}</p>
                              <p className="text-xs text-blue-600 font-medium">R{product.purchasePrice.toFixed(2)}</p>
                            </div>                            {!isAlreadyAdded ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddProduct(product, false);
                                }}
                                className="ml-2 p-1 text-blue-600 hover:bg-blue-100 rounded"
                              >
                                <FiPlus className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="ml-2 text-xs text-green-600 font-medium">Added</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {filteredProducts.length > 6 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Showing 6 of {filteredProducts.length} results. Click "Add Product" to see all.
                  </p>
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
                    <h3 className="text-xl font-semibold text-gray-900">Add Products to Purchase</h3>
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
                        className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                        autoFocus
                      />
                      <FiPackage className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Found {filteredProducts.length} products
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 200px)' }}>
                  {filteredProducts.length > 0 ? (
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredProducts.map((product) => {
                          const isAlreadyAdded = purchaseItems.some(item => item.productId === product.id);
                          return (
                            <div
                              key={product.id}
                              className={`border rounded-xl p-4 transition-all hover:shadow-md ${
                                isAlreadyAdded 
                                  ? 'bg-gray-50 border-gray-200 opacity-75' 
                                  : 'bg-white border-gray-200 hover:border-blue-300 cursor-pointer'
                              }`}
                              onClick={() => !isAlreadyAdded && handleAddProduct(product)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <h4 className="font-medium text-gray-900">{product.name}</h4>
                                    {isAlreadyAdded && (
                                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                        Added
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-1 text-sm text-gray-600">
                                    <p><span className="font-medium">SKU:</span> {product.sku}</p>
                                    {product.barcode && (
                                      <p><span className="font-medium">Barcode:</span> {product.barcode}</p>
                                    )}
                                    <div className="flex items-center space-x-4 mt-2">
                                      <p><span className="font-medium">Current Stock:</span> 
                                        <span className={`ml-1 ${product.stockQty <= 10 ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                                          {product.stockQty}
                                        </span>
                                      </p>
                                      <p><span className="font-medium">Cost:</span> 
                                        <span className="ml-1 font-semibold">R{product.purchasePrice.toFixed(2)}</span>
                                      </p>
                                      <p><span className="font-medium">Sell:</span> 
                                        <span className="ml-1">R{product.sellPrice.toFixed(2)}</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                {!isAlreadyAdded && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddProduct(product);
                                    }}
                                    className="ml-4 flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-colors"
                                  >
                                    <FiPlus className="w-4 h-4 mr-1" />
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <FiPackage className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium mb-2">No products found</p>
                      <p className="text-sm">Try adjusting your search terms</p>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      {filteredProducts.length} products available
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
            {/* Purchase Items List */}
          {purchaseItems.length > 0 ? (
            <div className="space-y-4">
              {purchaseItems.map((item, index) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FiPackage className="w-5 h-5 text-blue-600" />
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
                        {item.brandName && (
                          <p><span className="font-medium">Brand:</span> {item.brandName}</p>
                        )}
                        <p><span className="font-medium">Current Stock:</span> 
                          <span className={`ml-1 font-semibold ${item.currentStockQty <= 10 ? 'text-red-600' : 'text-green-600'}`}>
                            {item.currentStockQty}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePurchaseItem(item.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title="Remove item"
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FiHash className="inline w-4 h-4 mr-1" />
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updatePurchaseItem(item.id, 'quantity', Number(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-medium"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FiDollarSign className="inline w-4 h-4 mr-1" />
                        Purchase Price (R) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.newPurchasePrice}
                        onChange={(e) => updatePurchaseItem(item.id, 'newPurchasePrice', Number(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-medium"
                        required
                      />
                      {item.newPurchasePrice !== item.currentPurchasePrice && (
                        <p className="text-xs text-orange-600 mt-1 font-medium">
                          Changed from R{item.currentPurchasePrice.toFixed(2)}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Stock Level
                      </label>
                      <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                        <span className="text-lg font-bold text-green-700">
                          {item.currentStockQty + item.quantity}
                        </span>
                        <span className="text-sm text-green-600 ml-1">
                          (+{item.quantity})
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Total Amount
                      </label>
                      <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-lg font-bold text-blue-700">
                          R{item.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Totals Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl border-2 border-blue-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <FiDollarSign className="mr-2 text-blue-600" />
                  Purchase Summary
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
            <div className="text-center py-12 text-gray-500">
              <FiPackage className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No products added yet</p>
              <p className="text-sm">Click "Add Product" to start building your purchase</p>
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
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting || isLoadingData || purchaseItems.length === 0}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {isSubmitting ? (
                <>
                  <FiLoader className="animate-spin mr-2 w-4 h-4" />
                  Processing...
                </>
              ) : (
                <>
                  <FiSave className="mr-2 w-4 h-4" />
                  Save Purchase
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddPurchasePage;
