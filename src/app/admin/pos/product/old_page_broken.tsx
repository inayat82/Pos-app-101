// filepath: c:\\Users\\USER-PC\\My Drive\\Sync App\\Ai\\Project\\app-101\\pos-app\\src\\app\\admin\\pos\\product\\page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiUpload, FiDownload, FiFilter, FiSearch, FiEdit, FiTrash2, FiImage, FiLoader, FiAlertCircle, FiShoppingCart, FiPackage } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import EditProductModal from '@/components/admin/EditProductModal';
import AddToPurchaseModal from '@/components/admin/AddToPurchaseModal';
import { ProductFormData } from '@/types/pos';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import POSLayout from '@/components/admin/POSLayout';
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, Timestamp, onSnapshot, orderBy } from 'firebase/firestore';

import { Product as ProductType, Brand as BrandType, Category as CategoryType, Supplier as SupplierType, PurchaseOrderItem, PurchaseOrder } from '@/types/pos';

// PageProduct now directly uses ProductType as its base, since ProductType includes all necessary fields
export interface PageProduct extends ProductType {
  brandName?: string;
  categoryName?: string;
  supplierName?: string;
}

const ProductPage = () => {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<PageProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesToShow, setEntriesToShow] = useState(10);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<PageProduct | null>(null);
  const [selectedProductForPurchase, setSelectedProductForPurchase] = useState<PageProduct | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null); // For page-level errors

  const [brands, setBrands] = useState<BrandType[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierType[]>([]);
  const [isLoadingAssociations, setIsLoadingAssociations] = useState(true);

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
    }, (err) => {
      console.error(`Error fetching ${collectionName}:`, err);
      setPageError(`Failed to fetch ${collectionName}.`);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (currentUser?.uid) {
      setIsLoadingAssociations(true);
      setPageError(null);
      const unsubPromises = [
        fetchData('brands', setBrands, currentUser.uid),
        fetchData('categories', setCategories, currentUser.uid),
        fetchData('suppliers', setSuppliers, currentUser.uid),
      ];

      Promise.all(unsubPromises)
        .then(() => setIsLoadingAssociations(false))
        .catch((err) => {
          console.error("Error fetching associations:", err);
          setPageError("Failed to load all required data (brands, categories, or suppliers).");
          setIsLoadingAssociations(false);
        });

      return () => {
        unsubPromises.forEach(async unsubPromise => {
          try {
            const unsub = await unsubPromise;
            if (typeof unsub === 'function') unsub();
          } catch (e) {
            console.warn("Error unsubscribing from association fetch:", e);
          }
        });
      };
    } else {
      setBrands([]);
      setCategories([]);
      setSuppliers([]);
      setIsLoadingAssociations(false);
    }
  }, [currentUser, fetchData]);
  useEffect(() => {
    if (currentUser?.uid) {
      setIsLoading(true);
      setPageError(null);
      const productsColRef = collection(db, `admins/${currentUser.uid}/pos_products`);
      const q = query(productsColRef, orderBy('name', 'asc'));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const productsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          adminId: currentUser.uid,
          ...doc.data(),
        } as PageProduct));
        setProducts(productsList);
        setIsLoading(false);
      }, (err) => {
        console.error("Error fetching products:", err);
        setPageError("Failed to fetch products. Please try again.");
        setIsLoading(false);
      });
      return () => unsubscribe();
    } else {
      setProducts([]);
      setIsLoading(false);    }
  }, [currentUser]);
  const openEditModal = (product: PageProduct) => {
    setError(null); // Clear previous errors
    setSelectedProductForEdit(product);
    setIsEditModalOpen(true);
  };  const handleUpdateProduct = async (
    updatedProductData: ProductFormData,
    imageFile?: File
  ) => {
    if (!currentUser?.uid || !selectedProductForEdit) {
      setError("User not authenticated or no product selected for update.");
      throw new Error("User not authenticated or no product selected");
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const productRef = doc(db, `admins/${currentUser.uid}/pos_products`, selectedProductForEdit.id);
      let imageUrlToUpdate = selectedProductForEdit.imageUrl;
      let imagePathToUpdate = selectedProductForEdit.imagePath;

      // Handle image upload through our API endpoint
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
        imageUrlToUpdate = uploadResult.imageUrl;
        imagePathToUpdate = uploadResult.storagePath;
      }      // Construct the payload with only fields that are part of ProductType and are being updated.
      // Filter out undefined values to avoid Firestore errors
      const productUpdatePayload: any = {
        name: updatedProductData.name,
        sku: updatedProductData.sku,
        purchasePrice: updatedProductData.purchasePrice,
        sellPrice: updatedProductData.sellPrice,
        stockQty: updatedProductData.stockQty,
        updatedAt: Timestamp.now(),
      };      // Only add optional fields if they have valid values
      if (updatedProductData.barcode && updatedProductData.barcode.trim() !== '') {
        productUpdatePayload.barcode = updatedProductData.barcode;
      }
      if (updatedProductData.brandId && updatedProductData.brandId.trim() !== '') {
        productUpdatePayload.brandId = updatedProductData.brandId;
      }
      if (updatedProductData.categoryId && updatedProductData.categoryId.trim() !== '') {
        productUpdatePayload.categoryId = updatedProductData.categoryId;
      }
      if (updatedProductData.supplierId && updatedProductData.supplierId.trim() !== '') {
        productUpdatePayload.supplierId = updatedProductData.supplierId;
      }
      if (updatedProductData.reorderLevel !== undefined && updatedProductData.reorderLevel !== null) {
        productUpdatePayload.reorderLevel = updatedProductData.reorderLevel;
      }
      if (imageUrlToUpdate) {
        productUpdatePayload.imageUrl = imageUrlToUpdate;
      }
      if (imagePathToUpdate) {
        productUpdatePayload.imagePath = imagePathToUpdate;
      }

      await updateDoc(productRef, productUpdatePayload);
      setIsEditModalOpen(false);
      setSelectedProductForEdit(null);
    } catch (err: any) {
      console.error("Error updating product: ", err);
      setError(`Failed to update product: ${err.message || "Please try again."}`);
      throw err; // Re-throw for modal to handle its own state if needed
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productPath?: string) => {
    if (!currentUser?.uid) {
      setPageError("User not authenticated to delete products.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      return;
    }
    setIsSubmitting(true);
    setPageError(null);
    try {
      if (productPath) {
        const storage = getStorage();
        const imageToDeleteRef = storageRef(storage, productPath);
        try {
          await deleteObject(imageToDeleteRef);
        } catch (imgDeleteError: any) {
          console.warn("Could not delete product image from storage:", imgDeleteError.message);
        }
      }
      await deleteDoc(doc(db, `admins/${currentUser.uid}/pos_products`, productId));
    } catch (err: any) {
      console.error("Error deleting product: ", err);
      setPageError(`Failed to delete product: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };  // Handler for adding product to purchase order
  const handleAddToPurchaseOrder = async (product: PageProduct) => {
    if (!currentUser?.uid) {
      setError("User not authenticated.");
      return;
    }    try {
      // Fetch purchase history for this product
      const historyRef = collection(db, `admins/${currentUser.uid}/purchase_history`);
      const historyQuery = query(
        historyRef, 
        where('productId', '==', product.id),
        orderBy('purchaseDate', 'desc')
      );
      
      const historySnapshot = await getDocs(historyQuery);
      const history = historySnapshot.docs.map(doc => ({
        ...doc.data(),
        purchaseDate: doc.data().purchaseDate.toDate()
      }));      setPurchaseHistory(history);
      setSelectedProductForPurchase(product);
      setIsPurchaseModalOpen(true);
    } catch (err: any) {
      console.error("Error fetching purchase history:", err);
      // If history fetch fails (e.g., collection doesn't exist), still show modal with empty history
      setPurchaseHistory([]);
      setSelectedProductForPurchase(product);
      setIsPurchaseModalOpen(true);
    }
  };

  const handleAddToPending = async (quantity: number) => {
    if (!currentUser?.uid || !selectedProductForPurchase) {
      throw new Error("User not authenticated or no product selected.");
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create a purchase order item with only defined values
      const purchaseOrderItemData: any = {
        productId: selectedProductForPurchase.id,
        productName: selectedProductForPurchase.name,
        productSku: selectedProductForPurchase.sku,
        purchasePrice: selectedProductForPurchase.purchasePrice,
        quantity: quantity,
        totalAmount: selectedProductForPurchase.purchasePrice * quantity,
        adminId: currentUser.uid,
        dateAdded: Timestamp.now(),
        status: 'pending'
      };

      // Only add optional fields if they have values
      if (selectedProductForPurchase.barcode) {
        purchaseOrderItemData.productBarcode = selectedProductForPurchase.barcode;
      }
      if (selectedProductForPurchase.brandId) {
        purchaseOrderItemData.brandId = selectedProductForPurchase.brandId;
        purchaseOrderItemData.brandName = getAssociationName(selectedProductForPurchase.brandId, brands);
      }
      if (selectedProductForPurchase.categoryId) {
        purchaseOrderItemData.categoryId = selectedProductForPurchase.categoryId;
        purchaseOrderItemData.categoryName = getAssociationName(selectedProductForPurchase.categoryId, categories);
      }
      if (selectedProductForPurchase.supplierId) {
        purchaseOrderItemData.supplierId = selectedProductForPurchase.supplierId;
        purchaseOrderItemData.supplierName = getAssociationName(selectedProductForPurchase.supplierId, suppliers);
      }

      // Add to purchase_order_items collection
      await addDoc(collection(db, `admins/${currentUser.uid}/purchase_order_items`), purchaseOrderItemData);
      
      // Show success message
      alert(`✅ ${quantity} units of "${selectedProductForPurchase.name}" have been added to your pending purchase list!\n\nYou can view and manage your pending purchases in the Purchase System section.`);
      
    } catch (err: any) {
      console.error("Error adding product to purchase order:", err);
      throw new Error(`Failed to add product to purchase order: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAssociationName = (id: string | undefined, associations: Array<{id: string, name: string}>) => {
    if (!id) return 'N/A';
    const found = associations.find(item => item.id === id);
    return found ? found.name : 'N/A';
  };

  const filteredProducts = products.filter(product => {
    const searchTermLower = searchTerm.toLowerCase();
    const brandName = getAssociationName(product.brandId, brands).toLowerCase();
    const categoryName = getAssociationName(product.categoryId, categories).toLowerCase();
    const supplierName = getAssociationName(product.supplierId, suppliers).toLowerCase();

    return (
      product.name.toLowerCase().includes(searchTermLower) ||
      (product.sku && product.sku.toLowerCase().includes(searchTermLower)) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTermLower)) ||
      brandName.includes(searchTermLower) ||
      categoryName.includes(searchTermLower) ||
      supplierName.includes(searchTermLower)
    );
  });

  const paginatedProducts = filteredProducts.slice(0, entriesToShow);

  if (!currentUser) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen flex flex-col items-center justify-center">
        <FiAlertCircle className="text-red-500 text-6xl mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Authentication Required</h2>
        <p className="text-gray-600">Please log in to manage products.</p>
      </div>
    );
  }

  return (
    <POSLayout
      pageTitle="Product Management"
      pageDescription="Add, edit, and organize your product inventory."
      breadcrumbs={[
        { label: 'POS System' },
        { label: 'Product Management' }
      ]}
    >
      <div className="p-6">
        {pageError && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
            <div className="flex items-center">
              <FiAlertCircle className="mr-3 text-red-500" size={20} />
              <span className="text-red-700 font-medium">{pageError}</span>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiPackage className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Total Products</div>
                <div className="text-2xl font-bold text-slate-900">{products.length}</div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiSearch className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Filtered Results</div>
                <div className="text-2xl font-bold text-slate-900">{filteredProducts.length}</div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiLoader className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Showing</div>
                <div className="text-2xl font-bold text-slate-900">{Math.min(entriesToShow, filteredProducts.length)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-slate-200">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-grow w-full md:w-auto flex items-center border border-slate-300 rounded-lg px-3 py-2">
              <FiSearch className="text-slate-500 mr-2" />
              <input
                type="text"
                placeholder="Search products by name, SKU, barcode, brand, category, supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow focus:outline-none text-sm"
                disabled={isLoading || isLoadingAssociations || isSubmitting}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center text-sm text-slate-600">
                <span className="mr-2">Show:</span>
                <select
                  value={entriesToShow}
                  onChange={(e) => setEntriesToShow(Number(e.target.value))}
                  className="border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  disabled={isLoading || isLoadingAssociations || isSubmitting}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="ml-2">entries</span>
              </div>
              <button
                onClick={() => router.push('/admin/pos/product/add')}
                disabled={isLoadingAssociations || isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiPlus className="mr-2" size={16} /> Add Product
              </button>
            </div>
          </div>
        </div>
      </div>

        <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-slate-200">
          {/* Table Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Product Inventory ({paginatedProducts.length})
                </h2>
                <p className="text-slate-600 text-sm mt-1">
                  Manage your product catalog and inventory
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <FiImage size={14} />
                      Product
                    </div>
                  </th>
                  <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Brand</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Category</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Supplier</th>
                  <th className="py-3 px-6 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Purchase Price</th>
                  <th className="py-3 px-6 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Selling Price</th>
                  <th className="py-3 px-6 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Stock Qty</th>
                  <th className="py-3 px-6 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {(isLoading || isLoadingAssociations) && (
                  <tr>
                    <td colSpan={8} className="py-20 px-4 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                          <FiLoader className="animate-spin text-3xl text-white" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">Loading products...</h3>
                        <p className="text-slate-500">Fetching product data and associations</p>
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && !isLoadingAssociations && !pageError && paginatedProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-20 px-4 text-center">
                      <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                        <FiPackage className="text-4xl text-blue-600" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 mb-3">No Products Found</h3>
                      <p className="text-lg text-slate-600 mb-6 max-w-md mx-auto">
                        {searchTerm ? 'No results match your search criteria.' : 'Start by adding your first product to the inventory.'}
                      </p>
                      <button
                        onClick={() => router.push('/admin/pos/product/add')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Add First Product
                      </button>
                    </td>
                  </tr>
                )}
                {!isLoading && !isLoadingAssociations && !pageError && paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-blue-50 transition-colors border-b border-slate-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <FiImage className="text-slate-400 text-2xl" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900 text-lg">{product.name}</div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">SKU: {product.sku}</span>
                            {product.barcode && <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">BC: {product.barcode}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-800">
                        {getAssociationName(product.brandId, brands)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-slate-900">{getAssociationName(product.categoryId, categories)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-slate-900">{getAssociationName(product.supplierId, suppliers)}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-lg font-bold text-slate-900">R {product.purchasePrice.toFixed(2)}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-lg font-bold text-slate-900">R {product.sellPrice.toFixed(2)}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-lg font-semibold text-slate-900">{product.stockQty}</div>
                      <div className="text-sm text-slate-500">units</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => openEditModal(product)}
                          disabled={isSubmitting}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                          title="Edit Product"
                        >
                          <FiEdit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id, product.imagePath)}
                          disabled={isSubmitting}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                          title="Delete Product"
                        >
                          <FiTrash2 size={16} />
                        </button>
                        <button
                          onClick={() => handleAddToPurchaseOrder(product)}
                          disabled={isSubmitting}
                          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                          title="Add to Purchase Order"
                        >
                          <div className="flex items-center gap-2">
                            <FiShoppingCart size={14} />
                            Purchase
                          </div>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredProducts.length > entriesToShow && (
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
              <div className="flex justify-center">
                <button
                  onClick={() => setEntriesToShow(prev => prev + 10)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  disabled={isSubmitting}
                >
                  Load More Products
                </button>
              </div>
            </div>
          )}
        </div>        {isEditModalOpen && selectedProductForEdit && (
          <EditProductModal
            isOpen={isEditModalOpen}
            onClose={() => { setIsEditModalOpen(false); setSelectedProductForEdit(null); setError(null); }}
            onProductUpdate={handleUpdateProduct}
            product={selectedProductForEdit}
            brands={brands}
            categories={categories}
            suppliers={suppliers}
            error={error} // Pass error
            isLoading={isSubmitting}
          />
        )}

        {isPurchaseModalOpen && selectedProductForPurchase && (
          <AddToPurchaseModal
            isOpen={isPurchaseModalOpen}
            onClose={() => { 
              setIsPurchaseModalOpen(false); 
              setSelectedProductForPurchase(null); 
              setPurchaseHistory([]);
              setError(null); 
            }}
            product={selectedProductForPurchase}
            suppliers={suppliers}
            purchaseHistory={purchaseHistory}
            onAddToPending={handleAddToPending}
            isLoading={isSubmitting}
          />
        )}
      </div>
    </POSLayout>
  );
};

export default ProductPage;
