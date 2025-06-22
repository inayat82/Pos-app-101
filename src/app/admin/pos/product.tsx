'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiUpload, FiDownload, FiFilter, FiSearch, FiEdit, FiTrash2, FiImage } from 'react-icons/fi';
import AddProductModal from '@/components/admin/AddProductModal';
import EditProductModal from '@/components/admin/EditProductModal'; // Import EditProductModal
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, Timestamp, orderBy } from 'firebase/firestore';
import { ProductFormData } from '@/types/pos';

export interface Product {
  id: string;
  adminId: string;
  imageUrl?: string;
  imagePath?: string;
  name: string;
  sku: string;
  barcode?: string;
  purchasePrice: number;
  sellPrice: number;
  stockQty: number;
  reorderLevel?: number;
  brandId?: string;
  categoryId?: string;
  supplierId?: string;
  rackNo?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const ProductPage = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesToShow, setEntriesToShow] = useState(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // State for edit modal
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null); // State for product to edit
  const [error, setError] = useState<string | null>(null);

  // Fetch products from Firestore
  useEffect(() => {
    if (currentUser?.uid) {
      const fetchProducts = async () => {
        setIsLoadingProducts(true);
        setError(null);
        try {          const productsColRef = collection(db, `admins/${currentUser.uid}/pos_products`);
          const q = query(productsColRef, orderBy('name', 'asc'));
          const querySnapshot = await getDocs(q);
          const productsList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as Product));
          setProducts(productsList);
        } catch (err) {
          console.error("Error fetching products:", err);
          setError("Failed to fetch products. Please try again.");
        }
        setIsLoadingProducts(false);
      };
      fetchProducts();
    }
  }, [currentUser]);  const handleAddProduct = async (newProductData: ProductFormData, imageFile?: File) => {
    if (!currentUser?.uid) {
      setError("User not authenticated to add products.");
      return;
    }
    try {
      let imageUrl = '';
      let imagePath = '';

      // Upload image if provided
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('adminId', currentUser.uid);
        formData.append('uploadType', 'products');

        const uploadResponse = await fetch('/api/admin/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }

        const uploadResult = await uploadResponse.json();
        imageUrl = uploadResult.imageUrl;
        imagePath = uploadResult.storagePath;
      }

      const docRef = await addDoc(collection(db, `admins/${currentUser.uid}/pos_products`), {
        ...newProductData,
        imageUrl: imageUrl || undefined,
        imagePath: imagePath || undefined,
        adminId: currentUser.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      const newProduct = { 
        ...newProductData, 
        id: docRef.id, 
        imageUrl: imageUrl || undefined,
        imagePath: imagePath || undefined,
        adminId: currentUser.uid, 
        createdAt: Timestamp.now(), 
        updatedAt: Timestamp.now() 
      } as Product;
      
      setProducts(prevProducts => [...prevProducts, newProduct]);
      setIsAddModalOpen(false);
      setError(null);
    } catch (err: any) {
      console.error("Error adding product: ", err);
      setError(err.message || "Failed to add product. Please try again.");
    }
  };

  const openEditModal = (product: Product) => {
    setSelectedProductForEdit(product);
    setIsEditModalOpen(true);
  };
  const handleUpdateProduct = async (productData: ProductFormData, imageFile?: File) => {
    if (!currentUser?.uid || !selectedProductForEdit) {
      setError("User not authenticated or no product selected for update.");
      return;
    }
    try {
      let imageUrl = selectedProductForEdit.imageUrl || '';
      let imagePath = selectedProductForEdit.imagePath || '';

      // Upload image if provided
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('adminId', currentUser.uid);
        formData.append('uploadType', 'products');

        const uploadResponse = await fetch('/api/admin/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }

        const uploadResult = await uploadResponse.json();
        imageUrl = uploadResult.imageUrl;
        imagePath = uploadResult.storagePath;
      }

      const productRef = doc(db, `admins/${currentUser.uid}/pos_products`, selectedProductForEdit.id);
      const updatedProductData = { 
        ...productData, 
        imageUrl: imageUrl || undefined,
        imagePath: imagePath || undefined,
        updatedAt: Timestamp.now() 
      };

      await updateDoc(productRef, updatedProductData);
      
      const updatedProduct = {
        ...selectedProductForEdit,
        ...updatedProductData,
        id: selectedProductForEdit.id,
        adminId: currentUser.uid
      };
      
      setProducts(prevProducts => 
        prevProducts.map(p => (p.id === selectedProductForEdit.id ? updatedProduct : p))
      );
      setIsEditModalOpen(false);
      setSelectedProductForEdit(null);
      setError(null);
    } catch (err: any) {
      console.error("Error updating product: ", err);
      setError(err.message || "Failed to update product. Please try again.");
      // Keep modal open if error
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!currentUser?.uid) {
      setError("User not authenticated to delete products.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      return;
    }

    try {
      const productRef = doc(db, `admins/${currentUser.uid}/pos_products`, productId);
      await deleteDoc(productRef);
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error("Error deleting product: ", err);
      setError("Failed to delete product. Please try again.");
    }
  };
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm)) ||
    (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
      <div className="bg-white shadow-md rounded-lg p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">Manage Products</h1>

        {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4 text-sm">{error}</p>}

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <label htmlFor="entries" className="text-sm text-gray-600">Show</label>
            <select
              id="entries"
              value={entriesToShow}
              onChange={(e) => setEntriesToShow(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">entries</span>
          </div>

          <div className="relative w-full md:w-auto">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 rounded-md pl-10 pr-4 py-2 text-sm w-full md:w-64 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-end space-y-3 md:space-y-0 md:space-x-3 mb-6">
          <button 
            onClick={() => setIsAddModalOpen(true)} 
            className="w-full md:w-auto flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm text-sm transition duration-150 ease-in-out"
            disabled={!currentUser?.uid}
          >
            <FiPlus className="mr-2" /> Add Product
          </button>
          <button className="w-full md:w-auto flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm text-sm transition duration-150 ease-in-out">
            <FiUpload className="mr-2" /> Import
          </button>
          <button className="w-full md:w-auto flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm text-sm transition duration-150 ease-in-out">
            <FiDownload className="mr-2" /> Export
          </button>
          <button className="w-full md:w-auto flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm text-sm transition duration-150 ease-in-out">
            <FiFilter className="mr-2" /> Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Price</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sell Price</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rack No.</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Qty</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoadingProducts ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-gray-500">
                    Loading products...
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.slice(0, entriesToShow).map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-gray-200 flex items-center justify-center">
                          <FiImage className="text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.barcode}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">R {product.purchasePrice.toFixed(2)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">R {product.sellPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.rackNo || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.stockQty}</td>                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.supplierId || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.brandId || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.categoryId || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button onClick={() => openEditModal(product)} className="text-indigo-600 hover:text-indigo-900 transition-colors duration-150" title="Edit Product">
                          <FiEdit size={18} />
                        </button>
                        <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-900 transition-colors duration-150" title="Delete Product">
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-gray-500">
                    <div className="flex flex-col items-center">
                      <FiSearch size={48} className="text-gray-400 mb-3" />
                      <p className="font-semibold">No products found.</p>
                      <p>Click '+ Add Product' to get started or try adjusting your search/filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>      {currentUser?.uid && (
        <AddProductModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setError(null);
          }}
          onProductAdd={handleAddProduct}
          brands={[]}
          categories={[]}
          suppliers={[]}
          error={error}
          isLoading={false}
          isLoadingAssociations={false}
        />
      )}

      {selectedProductForEdit && currentUser?.uid && (
        <EditProductModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedProductForEdit(null);
            setError(null);
          }}
          onProductUpdate={handleUpdateProduct}
          product={selectedProductForEdit}
          brands={[]}
          categories={[]}
          suppliers={[]}
          error={error}
          isLoading={false}
        />
      )}
    </div>
  );
};

export default ProductPage;
