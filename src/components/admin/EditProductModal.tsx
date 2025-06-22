'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { FiX, FiSave, FiUpload, FiAlertCircle, FiImage } from 'react-icons/fi';
import { Product as ProductType, Brand as BrandType, Category as CategoryType, Supplier as SupplierType, ProductFormData } from '@/types/pos';
import { PageProduct } from '@/app/admin/pos/product/page'; // For the product prop type

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductUpdate: (productData: ProductFormData, imageFile?: File) => Promise<void>;
  product: PageProduct | null;
  brands: BrandType[];
  categories: CategoryType[];
  suppliers: SupplierType[];
  error?: string | null;
  isLoading?: boolean;
}

const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  onProductUpdate,
  product,
  brands,
  categories,
  suppliers,
  error: initialError,
  isLoading: isSaving,
}) => {
  const [formData, setFormData] = useState<Partial<ProductFormData>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        brandId: product.brandId || '',
        categoryId: product.categoryId || '',
        supplierId: product.supplierId || '',
        purchasePrice: product.purchasePrice !== undefined ? product.purchasePrice : undefined,        sellPrice: product.sellPrice !== undefined ? product.sellPrice : 0,
        stockQty: product.stockQty !== undefined ? product.stockQty : 0,
        reorderLevel: product.reorderLevel !== undefined ? product.reorderLevel : undefined,
        // rackNo: product.rackNo || '', // Assuming rackNo is part of PageProduct if needed
      });
      setImagePreview(product.imageUrl || null);
      setImageFile(null); // Reset file input when product changes
    } else {
      setFormData({});
      setImagePreview(null);
      setImageFile(null);
    }
    setFormError(null); // Clear form error when product changes or modal opens
  }, [product]);

  useEffect(() => {
    setFormError(initialError || null);
  }, [initialError]);

  if (!isOpen || !product) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<ProductFormData>) => ({ ...prev, [name]: value }));
    setFormError(null);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<ProductFormData>) => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    setFormError(null);
  };

  const handleIntegerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<ProductFormData>) => ({ ...prev, [name]: value === '' ? undefined : parseInt(value, 10) }));
    setFormError(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setFormError(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);    if (!formData.name || !formData.sku || formData.purchasePrice === undefined || formData.sellPrice === undefined || formData.stockQty === undefined) {
      setFormError('Please fill in all required fields: Name, SKU, Purchase Price, Sell Price, and Quantity.');
      return;
    }
    if (formData.purchasePrice < 0 || formData.sellPrice < 0 || formData.stockQty < 0) {
      setFormError('Prices and quantity cannot be negative.');
      return;
    }    const productDataToSave: ProductFormData = {
      name: formData.name,
      sku: formData.sku,
      purchasePrice: formData.purchasePrice,      sellPrice: formData.sellPrice,
      stockQty: formData.stockQty,
    };    // Only add optional fields if they have values
    if (formData.barcode && formData.barcode.trim() !== '') productDataToSave.barcode = formData.barcode;
    if (formData.brandId && formData.brandId.trim() !== '') productDataToSave.brandId = formData.brandId;
    if (formData.categoryId && formData.categoryId.trim() !== '') productDataToSave.categoryId = formData.categoryId;
    if (formData.supplierId && formData.supplierId.trim() !== '') productDataToSave.supplierId = formData.supplierId;
    if (formData.reorderLevel !== undefined && formData.reorderLevel !== null) {
      productDataToSave.reorderLevel = formData.reorderLevel;
    }

    try {
      await onProductUpdate(productDataToSave, imageFile || undefined);
      // onClose(); // Parent should handle close on success
    } catch (updateError: any) {
      console.error("Error updating product in modal:", updateError);
      if (!initialError) {
        setFormError(updateError.message || "Failed to update product. Please try again.");
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Edit Product</h2>
          <button onClick={onClose} disabled={isSaving} className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50" aria-label="Close modal">
            <FiX size={24} />
          </button>
        </div>

        {(formError || initialError) && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md flex items-center">
            <FiAlertCircle className="mr-2 h-5 w-5" />
            <span>{formError || initialError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Name and SKU */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="editProductName" className="block text-sm font-medium text-gray-700 mb-1">Product Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="editProductName"
                name="name"
                value={formData.name || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="editProductSku" className="block text-sm font-medium text-gray-700 mb-1">SKU <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="editProductSku"
                name="sku"
                value={formData.sku || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>
          </div>

          {/* Barcode */}
          <div>
            <label htmlFor="editProductBarcode" className="block text-sm font-medium text-gray-700 mb-1">Barcode (Optional)</label>
            <input
              type="text"
              id="editProductBarcode"
              name="barcode"
              value={formData.barcode || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          {/* Brand, Category, Supplier Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="editProductBrand" className="block text-sm font-medium text-gray-700 mb-1">Brand</label>              <select
                id="editProductBrand"
                name="brandId"
                value={formData.brandId || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">Select Brand</option>
                {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="editProductCategory" className="block text-sm font-medium text-gray-700 mb-1">Category</label>              <select
                id="editProductCategory"
                name="categoryId"
                value={formData.categoryId || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">Select Category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="editProductSupplier" className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>              <select
                id="editProductSupplier"
                name="supplierId"
                value={formData.supplierId || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">Select Supplier</option>
                {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
              </select>
            </div>
          </div>

          {/* Purchase Price, Selling Price, Quantity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="editPurchasePrice" className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (R) <span className="text-red-500">*</span></label>
              <input
                type="number"
                id="editPurchasePrice"
                name="purchasePrice"
                value={formData.purchasePrice === undefined ? '' : formData.purchasePrice}
                onChange={handlePriceChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label htmlFor="editSellingPrice" className="block text-sm font-medium text-gray-700 mb-1">Selling Price (R) <span className="text-red-500">*</span></label>
              <input
                type="number"
                id="editSellingPrice"
                name="sellPrice"
                value={formData.sellPrice === undefined ? '' : formData.sellPrice}
                onChange={handlePriceChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label htmlFor="editStockQty" className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity <span className="text-red-500">*</span></label>
              <input
                type="number"
                id="editStockQty"
                name="stockQty" // Ensure name matches ProductFormData
                value={formData.stockQty === undefined ? '' : formData.stockQty}
                onChange={handleIntegerChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
                min="0"
              />
            </div>
          </div>

          {/* Reorder Level and Rack No (Optional) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="editReorderLevel" className="block text-sm font-medium text-gray-700 mb-1">Reorder Level (Optional)</label>
              <input
                type="number"
                id="editReorderLevel"
                name="reorderLevel"
                value={formData.reorderLevel === undefined ? '' : formData.reorderLevel}
                onChange={handleIntegerChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                min="0"
              />
            </div>
            {/* Rack No - can be added if needed and part of ProductFormData/PageProduct */}
            {/* <div>
              <label htmlFor="editRackNo" className="block text-sm font-medium text-gray-700 mb-1">Rack No. (Optional)</label>
              <input
                type="text"
                id="editRackNo"
                name="rackNo"
                value={formData.rackNo || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div> */}
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Image (Optional)</label>
            <div className="mt-1 flex items-center">
              <span className="inline-block h-20 w-20 rounded-md overflow-hidden bg-gray-100 mr-4 flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Product Preview" className="h-full w-full object-cover" />
                ) : (
                  <FiImage className="h-10 w-10 text-gray-400" />
                )}
              </span>
              <label htmlFor="editProductImageFile" className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <span>{imageFile ? 'Change image' : 'Upload image'}</span>
                <input id="editProductImageFile" name="imageFile" type="file" className="sr-only" onChange={handleImageChange} accept="image/*" />
              </label>
              {imagePreview && (
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(product?.imageUrl || null); }} className="ml-3 text-sm text-red-600 hover:text-red-800">
                  {imageFile ? 'Cancel Change' : (product?.imageUrl ? 'Revert to Original' : 'Remove Image')}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Max file size: 2MB. Recommended: Square aspect ratio.</p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !formData.name}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
            >
              <FiSave className="mr-2" />
              {isSaving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProductModal;
