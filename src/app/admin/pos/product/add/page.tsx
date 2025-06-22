// src/app/admin/pos/product/add/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiSave, FiArrowLeft, FiUploadCloud, FiPackage, FiTag, FiArchive, FiDollarSign, FiAlertCircle, FiLoader, FiRefreshCw, FiImage, FiTrash2, FiX, FiEdit3 } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, query, where, getDocs, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { Brand, Category, Supplier, ProductFormData } from '@/types/pos';
import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

// Dynamically import the markdown editor to avoid SSR issues
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
);

const AddProductPage = () => {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Set page title when component mounts
  useEffect(() => {
    setPageTitle('Add New Product');
    return () => setPageTitle(''); // Clean up on unmount
  }, [setPageTitle]);
  // Form state
  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [advancedDescription, setAdvancedDescription] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [sellPrice, setSellPrice] = useState<number | ''>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  // Additional fields
  const [location, setLocation] = useState('');
  const [rackNo, setRackNo] = useState('');
  const [stockHandler, setStockHandler] = useState('');
  const [modelNo, setModelNo] = useState('');
    // Loading and error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoadingAssociations, setIsLoadingAssociations] = useState(true);
    // Association data
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Generate a unique 13-digit barcode
  const generateBarcode = (): string => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const combined = (timestamp + random).slice(-12);
    return '2' + combined; // Start with 2 for internal products
  };

  // Generate barcode on mount
  useEffect(() => {
    if (!barcode) {
      setBarcode(generateBarcode());
    }
  }, [barcode]);

  // Regenerate barcode
  const handleRegenerateBarcode = () => {
    setBarcode(generateBarcode());
  };

  // Fetch brands, categories, and suppliers
  const fetchData = useCallback(async (collectionName: string, setter: Function, adminId: string) => {
    const collRef = collection(db, `admins/${adminId}/${collectionName}`);
    const q = query(collRef, orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const itemsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        adminId: adminId,
        ...doc.data(),
      })) as any[];
      setter(itemsList);
    }, (error) => {
      console.error(`Error fetching ${collectionName}:`, error);
      setError(`Failed to load ${collectionName}. Please try again.`);
    });
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (!currentUser?.uid) return;

    const adminId = currentUser.uid;
    setIsLoadingAssociations(true);

    Promise.all([
      fetchData('brands', setBrands, adminId),
      fetchData('categories', setCategories, adminId),
      fetchData('suppliers', setSuppliers, adminId),
    ]).then(() => {
      setIsLoadingAssociations(false);
    }).catch((error) => {
      console.error('Error setting up listeners:', error);
      setIsLoadingAssociations(false);
    });
  }, [currentUser?.uid, fetchData]);

  // Cleanup image preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);
  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };
  // Process image file (for both file input and drag & drop)
  const processImageFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file size must be less than 5MB');
      return;
    }

    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);    setError(null); // Clear any previous errors
  };

  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processImageFile(files[0]);
    }
  };

  // Handle image removal
  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setError(null);
  };

  // Validate form
  const validateForm = (): boolean => {
    setError(null);
    
    // Check required fields
    if (!productName.trim()) {
      setError('Product name is required');
      return false;
    }
    if (!sku.trim()) {
      setError('SKU is required');
      return false;
    }
    if (purchasePrice === '' || purchasePrice <= 0) {
      setError('Valid purchase price is required');
      return false;
    }
    if (sellPrice === '' || sellPrice <= 0) {
      setError('Valid sell price is required');
      return false;
    }

    // Check if sell price is lower than purchase price
    if (sellPrice < purchasePrice) {
      const confirmLowPrice = window.confirm(
        'Sell price is lower than purchase price. This will result in a loss. Do you want to continue?'
      );
      if (!confirmLowPrice) {
        return false;
      }
    }

    // Check SKU format
    if (sku.length < 3) {
      setError('SKU must be at least 3 characters long');
      return false;
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
      let imageUrl = '';
      
      console.log('Form submitted, adminId:', adminId);
      console.log('Has image file:', !!imageFile);
        // Upload image if provided
      if (imageFile) {
        console.log('Starting image upload...', imageFile.name, 'Size:', imageFile.size);
        
        try {
          // Use server-side upload API to avoid CORS issues
          const formData = new FormData();
          formData.append('file', imageFile);
          formData.append('adminId', adminId);
          
          console.log('Uploading via API route...');
          const uploadResponse = await fetch('/api/admin/upload-image', {
            method: 'POST',
            body: formData,
          });
          
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || 'Upload failed');
          }
          
          const uploadResult = await uploadResponse.json();
          if (uploadResult.success) {
            imageUrl = uploadResult.imageUrl;
            console.log('Image uploaded successfully via API:', imageUrl);
          } else {
            throw new Error(uploadResult.error || 'Upload failed');
          }            } catch (uploadError: any) {
          console.error('Image upload failed:', uploadError);
          
          // Silently continue without image - no more blocking dialogs
          console.warn('Image upload failed, saving product without image');
          
          // Clear the image from UI
          setImageFile(null);
          if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
            setImagePreviewUrl(null);
          }
          
          // Set a non-blocking info message
          setError('Note: Product will be saved without image. You can add an image later by editing the product.');
        }
      }console.log('Creating product data...');
      // Create product data - only include fields that have values
      const productData: any = {
        name: productName.trim(),
        sku: sku.trim(),
        purchasePrice: Number(purchasePrice),
        sellPrice: Number(sellPrice),
        stockQty: 0, // Default to 0, will be managed through Purchase/Adjustment
      };      // Add optional fields only if they have values and are not undefined
      if (barcode && barcode.trim()) productData.barcode = barcode.trim();
      if (advancedDescription && advancedDescription.trim()) productData.advancedDescription = advancedDescription.trim();
      if (selectedSupplierId && selectedSupplierId.trim()) productData.supplierId = selectedSupplierId;
      if (selectedBrandId && selectedBrandId.trim()) productData.brandId = selectedBrandId;
      if (selectedCategoryId && selectedCategoryId.trim()) productData.categoryId = selectedCategoryId;
      if (imageUrl && imageUrl.trim()) productData.imageUrl = imageUrl;
      if (location && location.trim()) productData.location = location.trim();
      if (rackNo && rackNo.trim()) productData.rackNo = rackNo.trim();
      if (stockHandler && stockHandler.trim()) productData.stockHandler = stockHandler.trim();
      if (modelNo && modelNo.trim()) productData.modelNo = modelNo.trim();

      console.log('Adding product to Firestore...', productData);
      
      // Clean undefined values from the product data (extra safety)
      const cleanProductData = Object.fromEntries(
        Object.entries(productData).filter(([_, value]) => value !== undefined && value !== null)
      );
      
      console.log('Cleaned product data:', cleanProductData);
      
      // Check if db is available
      if (!db) {
        throw new Error('Firestore is not initialized. Please check your Firebase configuration.');
      }
        // Add to Firestore
      const productsRef = collection(db, `admins/${adminId}/pos_products`);
      const finalProductData = {
        ...cleanProductData,
        adminId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
        console.log('Final product data for Firestore:', finalProductData);
      const docRef = await addDoc(productsRef, finalProductData);
      
      console.log('Product added successfully with ID:', docRef.id);
      
      // Show success message
      setSuccess(`Product "${productName}" has been added successfully!`);
      
      // Wait a moment to show success message, then redirect
      setTimeout(() => {
        router.push('/admin/pos/product');
      }, 1500);
      
    } catch (error: any) {
      console.error('Error adding product:', error);
      setError(error.message || 'Failed to add product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-full">      {/* Header - Enhanced */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all duration-200 text-sm font-medium border border-gray-300 hover:border-gray-400"
            >
              <FiArrowLeft className="mr-2 w-4 h-4" />
              Back to Products
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
              <p className="text-sm text-gray-600">Create a new product in your inventory</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              Draft
            </div>
          </div>
        </div>
      </div>      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start">
          <FiPackage className="text-green-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-green-800">Success!</h3>
            <p className="text-green-700 text-sm mt-1">{success}</p>
          </div>
        </div>
      )}

      {/* Error/Info Message */}
      {error && (
        <div className={`mb-6 p-4 rounded-xl flex items-start ${
          error.includes('Note:') || error.includes('without image') 
            ? 'bg-blue-50 border border-blue-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {error.includes('Note:') || error.includes('without image') ? (
            <FiPackage className="text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
          ) : (
            <FiAlertCircle className="text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className={`text-sm font-medium ${
              error.includes('Note:') || error.includes('without image') 
                ? 'text-blue-800' 
                : 'text-red-800'
            }`}>
              {error.includes('Note:') || error.includes('without image') ? 'Info' : 'Error'}
            </h3>
            <p className={`text-sm mt-1 ${
              error.includes('Note:') || error.includes('without image') 
                ? 'text-blue-700' 
                : 'text-red-700'
            }`}>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoadingAssociations && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center">
          <FiLoader className="animate-spin text-blue-600 mr-3 flex-shrink-0" />
          <div>
            <p className="text-blue-700 text-sm font-medium">Loading form data...</p>
            <p className="text-blue-600 text-xs">Please wait while we fetch suppliers, brands, and categories</p>
          </div>
        </div>
      )}{/* Form */}      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Row 1: Basic Product Details + Associations */}        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Basic Product Details */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <FiPackage className="text-blue-600 w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Product Details</h2>
            </div>
              <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                  placeholder="Enter product name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SKU *
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                  placeholder="Enter SKU (minimum 3 characters)"
                  required
                />
                {sku && sku.length < 3 && (
                  <p className="text-xs text-amber-600 mt-1">SKU should be at least 3 characters long</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Barcode
                </label>                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                    placeholder="13-digit barcode"
                    maxLength={13}
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateBarcode}
                    className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    title="Generate new barcode"
                  >
                    <FiRefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Auto-generated 13-digit barcode</p>
              </div>                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model No
                </label>
                <input
                  type="text"
                  value={modelNo}
                  onChange={(e) => setModelNo(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                  placeholder="Product model number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                  placeholder="Storage location"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rack No
                </label>
                <input
                  type="text"
                  value={rackNo}
                  onChange={(e) => setRackNo(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                  placeholder="Rack number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Handler
                </label>
                <input
                  type="text"
                  value={stockHandler}
                  onChange={(e) => setStockHandler(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                  placeholder="Person responsible for stock"
                />
              </div>
            </div>
          </div>          {/* Associations */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <FiTag className="text-green-600 w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Associations & Pricing</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier
                </label>                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand
                </label>
                <select
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                >
                  <option value="">Select Brand</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
                {/* Pricing Section - Moved from separate card */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                    <FiDollarSign className="text-yellow-600 w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Pricing</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Purchase Price (R) *
                    </label>                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sell Price (R) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                      placeholder="0.00"
                      required
                    />
                    {sellPrice && purchasePrice && sellPrice < purchasePrice && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center">
                        <FiAlertCircle className="w-3 h-3 mr-1" />
                        Sell price is lower than purchase price (loss)
                      </p>
                    )}
                  </div>
                    {/* Show margin/markup calculation */}
                  {purchasePrice && sellPrice && (
                    <div className={`mt-4 p-4 rounded-lg ${
                      sellPrice < purchasePrice 
                        ? 'bg-red-50 border border-red-200' 
                        : 'bg-green-50 border border-green-200'
                    }`}>
                      <div className="text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Margin:</span>
                          <span className={`font-semibold ${sellPrice < purchasePrice ? 'text-red-700' : 'text-green-700'}`}>
                            R{(sellPrice - purchasePrice).toFixed(2)} ({((sellPrice - purchasePrice) / sellPrice * 100).toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Markup:</span>
                          <span className={`font-semibold ${sellPrice < purchasePrice ? 'text-red-700' : 'text-green-700'}`}>
                            {((sellPrice - purchasePrice) / purchasePrice * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>        </div>        {/* Row 2: Advanced Description & Product Image */}
        <div className="grid grid-cols-1 gap-6">
          {/* Combined Advanced Description & Product Image */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Advanced Description Section - First */}
              <div>
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-purple-100 rounded-lg mr-3">
                    <FiEdit3 className="text-purple-600 w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Advanced Description</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Rich Text Description
                    </label>
                    <div className="border border-gray-300 rounded-md overflow-hidden">
                      <MDEditor
                        value={advancedDescription}
                        onChange={(value) => setAdvancedDescription(value || '')}
                        preview="edit"
                        height={300}
                        data-color-mode="light"
                        visibleDragbar={false}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Use markdown syntax for rich formatting. Support for headings, lists, links, images, etc.
                    </p>
                  </div>
                </div>
              </div>

              {/* Product Image Section - Second */}
              <div>
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-orange-100 rounded-lg mr-3">
                    <FiUploadCloud className="text-orange-600 w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Product Image (Optional)</h2>
                </div>
                
                <div className="space-y-4">
                  {/* Drag and Drop Area */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragOver
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {imagePreviewUrl ? (
                      <div className="relative">
                        <img
                          src={imagePreviewUrl}
                          alt="Product preview"
                          className="w-full h-48 object-cover rounded-md mx-auto"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          title="Remove image"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="py-8">
                        <FiImage className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <div className="text-gray-600">
                          <p className="mb-2">Drag and drop an image here, or</p>
                          <label className="cursor-pointer">
                            <span className="text-blue-600 hover:text-blue-700 font-medium">
                              click to select from computer
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="hidden"
                            />
                          </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Supports: JPG, PNG, GIF (max 5MB)
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* File Input Alternative */}
                  {!imagePreviewUrl && (
                    <div className="text-center">
                      <p className="text-sm text-gray-500 mb-2">Or use traditional file input:</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
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
              disabled={isSubmitting || isLoadingAssociations}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors min-w-[140px] justify-center"
            >
              {isSubmitting ? (
                <>
                  <FiLoader className="animate-spin mr-2 w-4 h-4" />
                  {imageFile ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                <>
                  <FiSave className="mr-2 w-4 h-4" />
                  Save Product
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddProductPage;
