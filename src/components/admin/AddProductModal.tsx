'use client';

import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { FiX, FiUploadCloud, FiPackage, FiTag, FiArchive, FiDollarSign, FiAlertCircle } from 'react-icons/fi';
import { Brand, Category, Supplier, ProductFormData } from '@/types/pos';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductAdd: (newProductData: ProductFormData, imageFile?: File) => Promise<void>;
  brands: Brand[];
  categories: Category[];
  suppliers: Supplier[];
  error: string | null;
  isLoading: boolean;
  isLoadingAssociations: boolean;
}

const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onProductAdd,
  brands,
  categories,
  suppliers,
  error: parentError,
  isLoading: isSubmitting,
  isLoadingAssociations,
}) => {
  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [sellPrice, setSellPrice] = useState<number | ''>('');
  const [stockQty, setStockQty] = useState<number | ''>('');
  const [reorderLevel, setReorderLevel] = useState<number | ''>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setProductName('');
      setSku('');
      setBarcode('');
      setPurchasePrice('');
      setSellPrice('');
      setStockQty('');
      setReorderLevel('');
      setSelectedSupplierId('');
      setSelectedBrandId('');
      setSelectedCategoryId('');
      setImageFile(null);
      setImagePreviewUrl(null);
      setLocalError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setLocalError('Invalid file type. Please select an image (JPEG, PNG, GIF, WebP).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setLocalError('File size exceeds 5MB. Please select a smaller image.');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreviewUrl(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!productName || !sku || purchasePrice === '' || sellPrice === '' || stockQty === '') {
      setLocalError('Please fill in all required fields: Name, SKU, Purchase Price, Sell Price, and Stock Quantity.');
      return;
    }
    if (Number(purchasePrice) < 0 || Number(sellPrice) < 0 || Number(stockQty) < 0 || (reorderLevel !== '' && Number(reorderLevel) < 0)) {
        setLocalError('Prices, quantity, and reorder level cannot be negative.');
        return;
    }    const productData: ProductFormData = {
      name: productName,
      sku,
      purchasePrice: Number(purchasePrice),
      sellPrice: Number(sellPrice),
      stockQty: Number(stockQty),
    };

    // Only add optional fields if they have values
    if (barcode) productData.barcode = barcode;
    if (selectedBrandId) productData.brandId = selectedBrandId;
    if (selectedCategoryId) productData.categoryId = selectedCategoryId;
    if (selectedSupplierId) productData.supplierId = selectedSupplierId;
    if (reorderLevel !== '') productData.reorderLevel = Number(reorderLevel);

    try {
      await onProductAdd(productData, imageFile || undefined);
    } catch (submissionError: any) {
      // Errors handled by parent
    }
  };

  const displayError = parentError || localError;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center p-4 z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[95vh]">
        <div className="flex justify-between items-center p-4 md:p-6 border-b sticky top-0 bg-white z-10 rounded-t-lg">
          <div className="flex items-center">
            <FiPackage className="text-xl text-indigo-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Add New Product</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            disabled={isSubmitting}
          >
            <FiX className="text-xl text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 overflow-y-auto space-y-6">
          {displayError && (
            <div className="flex items-center bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              <FiAlertCircle className="mr-2 flex-shrink-0" />
              <span className="text-sm">{displayError}</span>
            </div>
          )}

          {/* Product Details */}
          <fieldset className="border p-4 rounded-md">
            <legend className="text-lg font-medium text-gray-700 px-2 flex items-center">
              <FiPackage className="mr-2 text-indigo-500"/>Product Details
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                  disabled={isSubmitting || isLoadingAssociations}
                />
              </div>
              <div>
                <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
                  SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                  disabled={isSubmitting || isLoadingAssociations}
                />
              </div>
              <div>
                <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-1">Barcode (Optional)</label>
                <input
                  type="text"
                  id="barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  disabled={isSubmitting || isLoadingAssociations}
                />
              </div>
            </div>
          </fieldset>

          {/* Associations */}
          <fieldset className="border p-4 rounded-md">
            <legend className="text-lg font-medium text-gray-700 px-2 flex items-center">
              <FiTag className="mr-2 text-indigo-500"/>Associations
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div>
                <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select 
                  id="supplier"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                  disabled={isSubmitting || isLoadingAssociations}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <select 
                  id="brand"
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                  disabled={isSubmitting || isLoadingAssociations}
                >
                  <option value="">Select Brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select 
                  id="category"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                  disabled={isSubmitting || isLoadingAssociations}
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </fieldset>

          {/* Pricing */}
          <fieldset className="border p-4 rounded-md">
            <legend className="text-lg font-medium text-gray-700 px-2 flex items-center">
              <FiDollarSign className="mr-2 text-indigo-500"/>Pricing
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700 mb-1">
                  Purchase Price (R) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="purchasePrice"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                  min="0"
                  step="0.01"
                  disabled={isSubmitting || isLoadingAssociations}
                />
              </div>
              <div>
                <label htmlFor="sellPrice" className="block text-sm font-medium text-gray-700 mb-1">
                  Sell Price (R) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="sellPrice"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                  min="0"
                  step="0.01"
                  disabled={isSubmitting || isLoadingAssociations}
                />
              </div>
            </div>
          </fieldset>

          {/* Inventory */}
          <fieldset className="border p-4 rounded-md">
            <legend className="text-lg font-medium text-gray-700 px-2 flex items-center">
              <FiArchive className="mr-2 text-indigo-500"/>Inventory
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <label htmlFor="stockQty" className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="stockQty"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                  min="0"
                  disabled={isSubmitting || isLoadingAssociations}
                />
              </div>
              <div>
                <label htmlFor="reorderLevel" className="block text-sm font-medium text-gray-700 mb-1">
                  Reorder Level (Optional)
                </label>
                <input
                  type="number"
                  id="reorderLevel"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  min="0"
                  disabled={isSubmitting || isLoadingAssociations}
                />
              </div>
            </div>
          </fieldset>

          {/* Image Upload */}
          <fieldset className="border p-4 rounded-md">
            <legend className="text-lg font-medium text-gray-700 px-2 flex items-center">
              <FiUploadCloud className="mr-2 text-indigo-500"/>Product Image
            </legend>
            <div className="mt-2">
              <input
                type="file"
                id="productImage"
                onChange={handleImageChange}
                accept="image/*"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                disabled={isSubmitting || isLoadingAssociations}
              />
              {imagePreviewUrl && (
                <div className="mt-4">
                  <img src={imagePreviewUrl} alt="Preview" className="w-32 h-32 object-cover rounded-md border" />
                </div>
              )}
            </div>
          </fieldset>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              disabled={isSubmitting || isLoadingAssociations}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Product'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;
