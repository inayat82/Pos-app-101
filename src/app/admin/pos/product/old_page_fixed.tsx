'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiUpload, FiDownload, FiFilter, FiSearch, FiEdit, FiTrash2, FiImage, FiLoader, FiAlertCircle, FiShoppingCart, FiPackage, FiDollarSign, FiArchive, FiTag } from 'react-icons/fi';
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
    }, (error) => {
      console.error(`Error fetching ${collectionName}:`, error);
      setPageError(`Failed to load ${collectionName}. Please try again.`);
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
      setIsLoading(false);
    }
  }, [currentUser]);

  const openEditModal = (product: PageProduct) => {
    setError(null); // Clear previous errors
    setSelectedProductForEdit(product);
    setIsEditModalOpen(true);
  };

  const handleUpdateProduct = async (
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

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          if (uploadResult.success) {
            imageUrlToUpdate = uploadResult.imageUrl;
            imagePathToUpdate = uploadResult.imagePath || imagePathToUpdate;
          }
        }
      }

      const updateData = {
        ...updatedProductData,
        imageUrl: imageUrlToUpdate,
        imagePath: imagePathToUpdate,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(productRef, updateData);
      setIsEditModalOpen(false);
      setSelectedProductForEdit(null);
      alert(`Product "${updatedProductData.name}" has been updated successfully!`);

    } catch (error: any) {
      console.error('Error updating product:', error);
      setError(error.message || 'Failed to update product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!currentUser?.uid) {
      setError("User not authenticated.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const productRef = doc(db, `admins/${currentUser.uid}/pos_products`, productId);
      await deleteDoc(productRef);
      alert(`Product "${productName}" has been deleted successfully!`);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      setError(error.message || 'Failed to delete product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPurchaseModal = async (product: PageProduct) => {
    setSelectedProductForPurchase(product);
    setIsPurchaseModalOpen(true);
    
    // Optionally fetch purchase history
    try {
      const purchaseRef = collection(db, `admins/${currentUser?.uid}/purchase_orders`);
      const q = query(purchaseRef, where('items', 'array-contains-any', [product.id]));
      const querySnapshot = await getDocs(q);
      const purchases = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPurchaseHistory(purchases);
    } catch (error) {
      console.error('Error fetching purchase history:', error);
    }
  };

  const handleAddToPending = async (quantity: number) => {
    if (!currentUser?.uid || !selectedProductForPurchase) {
      setError("User not authenticated or no product selected.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const product = selectedProductForPurchase;
      const purchasePrice = product.purchasePrice || 0; // Use product's purchase price
      const purchaseItem: Omit<PurchaseOrderItem, 'id'> = {
        productId: product.id,
        productName: product.name,
        productSku: product.sku || '',
        productBarcode: product.barcode || '',
        brandId: product.brandId || '',
        brandName: getAssociationName(product.brandId, brands),
        categoryId: product.categoryId || '',
        categoryName: getAssociationName(product.categoryId, categories),
        supplierId: product.supplierId || '',
        supplierName: getAssociationName(product.supplierId, suppliers),
        purchasePrice: purchasePrice,
        quantity: quantity,
        totalAmount: quantity * purchasePrice,
        adminId: currentUser.uid,
        dateAdded: Timestamp.now(),
        status: 'pending'
      };

      await addDoc(collection(db, `admins/${currentUser.uid}/purchase_order_items`), purchaseItem);
      setIsPurchaseModalOpen(false);
      setSelectedProductForPurchase(null);
      alert(`${quantity} units of "${product.name}" added to pending purchase list!`);

    } catch (error: any) {
      console.error('Error adding to purchase:', error);
      setError(error.message || 'Failed to add product to purchase list. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAssociationName = (id: string | undefined, associations: any[]): string => {
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

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
            <div className="flex items-center">
              <FiAlertCircle className="mr-3 text-red-500" size={20} />
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiPackage className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Total Products</div>
                <div className="text-2xl font-bold text-slate-900">{products.length}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiArchive className="text-green-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">In Stock</div>
                <div className="text-2xl font-bold text-slate-900">
                  {products.filter(p => (p.stockQty || 0) > 0).length}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiAlertCircle className="text-amber-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Low Stock</div>
                <div className="text-2xl font-bold text-slate-900">
                  {products.filter(p => (p.stockQty || 0) <= 5 && (p.stockQty || 0) > 0).length}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiAlertCircle className="text-red-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Out of Stock</div>
                <div className="text-2xl font-bold text-slate-900">
                  {products.filter(p => (p.stockQty || 0) === 0).length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <FiLoader className="animate-spin text-3xl text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Loading products...</h3>
              <p className="text-slate-500">Fetching your product inventory</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Product Inventory</h2>
                  <p className="text-slate-600 text-sm mt-1">
                    Showing {paginatedProducts.length} of {filteredProducts.length} products
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
                    />
                  </div>
                  
                  <select
                    value={entriesToShow}
                    onChange={(e) => setEntriesToShow(Number(e.target.value))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={10}>Show 10</option>
                    <option value={25}>Show 25</option>
                    <option value={50}>Show 50</option>
                    <option value={100}>Show 100</option>
                  </select>
                  
                  <button
                    onClick={() => router.push('/admin/pos/product/add')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FiPlus size={16} />
                    Add Product
                  </button>
                </div>
              </div>
            </div>

            {/* Products List */}
            {paginatedProducts.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <FiPackage className="text-4xl text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-700 mb-2">
                  {searchTerm ? 'No products found' : 'No products yet'}
                </h3>
                <p className="text-slate-500 mb-6">
                  {searchTerm 
                    ? 'Try adjusting your search terms or filters.'
                    : 'Get started by adding your first product to the inventory.'
                  }
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => router.push('/admin/pos/product/add')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <FiPlus size={16} />
                    Add Your First Product
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Product Details
                      </th>
                      <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        SKU/Barcode
                      </th>
                      <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Brand/Category
                      </th>
                      <th className="py-3 px-6 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center justify-end gap-2">
                          <FiDollarSign size={14} />
                          Pricing
                        </div>
                      </th>
                      <th className="py-3 px-6 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center justify-end gap-2">
                          <FiPackage size={14} />
                          Stock
                        </div>
                      </th>
                      <th className="py-3 px-6 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {paginatedProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-blue-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FiImage className="text-slate-400" size={20} />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900 text-lg">{product.name}</div>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                                  ID: {product.id}
                                </span>
                                {product.supplierName && product.supplierName !== 'N/A' && (
                                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                    {product.supplierName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            {product.sku && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                {product.sku}
                              </span>
                            )}
                            {product.barcode && (
                              <div className="text-xs text-slate-600">{product.barcode}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-800">
                              {getAssociationName(product.brandId, brands)}
                            </span>
                            <div className="text-sm text-slate-600">
                              {getAssociationName(product.categoryId, categories)}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="space-y-1">
                            <div className="text-lg font-bold text-slate-900">
                              R {product.sellPrice?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-sm text-slate-500">
                              Cost: R {product.purchasePrice?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="space-y-1">
                            <div className={`text-lg font-semibold ${
                              (product.stockQty || 0) === 0 
                                ? 'text-red-600' 
                                : (product.stockQty || 0) <= 5 
                                  ? 'text-amber-600' 
                                  : 'text-green-600'
                            }`}>
                              {product.stockQty || 0}
                            </div>
                            <div className="text-sm text-slate-500">units</div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => openEditModal(product)}
                              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors rounded-lg"
                              title="Edit product"
                            >
                              <FiEdit size={16} />
                            </button>
                            <button
                              onClick={() => openPurchaseModal(product)}
                              className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors rounded-lg"
                              title="Add to purchase order"
                            >
                              <FiShoppingCart size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id, product.name)}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors rounded-lg"
                              title="Delete product"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            {paginatedProducts.length > 0 && (
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-slate-600">
                    Showing <span className="font-semibold">{paginatedProducts.length}</span> of{' '}
                    <span className="font-semibold">{filteredProducts.length}</span> products
                  </div>
                  {filteredProducts.length > entriesToShow && (
                    <button
                      onClick={() => setEntriesToShow(prev => prev + 25)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Load More
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit Product Modal */}
        {isEditModalOpen && selectedProductForEdit && (
          <EditProductModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedProductForEdit(null);
              setError(null);
            }}
            product={selectedProductForEdit}
            brands={brands}
            categories={categories}
            suppliers={suppliers}
            onProductUpdate={handleUpdateProduct}
            isLoading={isSubmitting}
          />
        )}

        {/* Add to Purchase Modal */}
        {isPurchaseModalOpen && selectedProductForPurchase && (
          <AddToPurchaseModal
            isOpen={isPurchaseModalOpen}
            onClose={() => {
              setIsPurchaseModalOpen(false);
              setSelectedProductForPurchase(null);
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
