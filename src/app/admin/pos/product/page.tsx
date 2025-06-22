// filepath: c:\\Users\\USER-PC\\My Drive\\Sync App\\Ai\\Project\\app-101\\pos-app\\src\\app\\admin\\pos\\product\\page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiUpload, FiDownload, FiFilter, FiSearch, FiEdit, FiTrash2, FiImage, FiLoader, FiAlertCircle, FiShoppingCart } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import EditProductModal from '@/components/admin/EditProductModal';
import AddToPurchaseModal from '@/components/admin/AddToPurchaseModal';
import { ProductFormData } from '@/types/pos';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
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
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manage Products</h1>
          <p className="text-sm text-gray-600">Add, edit, and organize your product inventory.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={() => router.push('/admin/pos/product/add')}
            disabled={isLoadingAssociations || isSubmitting}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center justify-center transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiPlus className="mr-2" /> Add Product
          </button>
        </div>
      </div>

      {pageError && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-400 rounded-md flex items-center">
          <FiAlertCircle className="mr-2 h-5 w-5" />
          <span>{pageError}</span>
        </div>
      )}

      <div className="mb-6 bg-white p-4 rounded-lg shadow flex flex-col md:flex-row items-center gap-4">
        <div className="flex-grow w-full md:w-auto flex items-center border border-gray-300 rounded-lg px-3 py-0.5">
          <FiSearch className="text-gray-500 mr-2" />
          <input
            type="text"
            placeholder="Search products by name, SKU, barcode, brand, category, supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow py-2 focus:outline-none text-sm"
            disabled={isLoading || isLoadingAssociations || isSubmitting}
          />
        </div>
        <div className="flex items-center text-sm text-gray-600 w-full md:w-auto">
          <span className="mr-2">Show:</span>
          <select
            value={entriesToShow}
            onChange={(e) => setEntriesToShow(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            disabled={isLoading || isLoadingAssociations || isSubmitting}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="ml-2">entries</span>
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal text-sm">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-xs leading-normal">
              <th className="py-3 px-4 text-left">Image</th>
              <th className="py-3 px-4 text-left">Name / SKU</th>
              <th className="py-3 px-4 text-left">Brand</th>
              <th className="py-3 px-4 text-left">Category</th>
              <th className="py-3 px-4 text-left">Supplier</th>
              <th className="py-3 px-4 text-right">Purchase Price</th>
              <th className="py-3 px-4 text-right">Selling Price</th>
              <th className="py-3 px-4 text-right">Stock Qty</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {(isLoading || isLoadingAssociations) && (
              <tr>
                <td colSpan={9} className="py-10 px-4 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <FiLoader className="animate-spin text-4xl mb-2" />
                    <span>Loading products and associations...</span>
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && !isLoadingAssociations && !pageError && paginatedProducts.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 px-4 text-center text-gray-500">
                  No products found. Try adjusting your search or add new products.
                </td>
              </tr>
            )}
            {!isLoading && !isLoadingAssociations && !pageError && paginatedProducts.map((product) => (
              <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50 transition duration-150 ease-in-out">
                <td className="py-2 px-4 text-left">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <FiImage className="text-gray-400 text-2xl" />
                    )}
                  </div>
                </td>
                <td className="py-2 px-4 text-left">
                  <div className="font-medium text-gray-800">{product.name}</div>
                  <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                  {product.barcode && <div className="text-xs text-gray-500">BC: {product.barcode}</div>}
                </td>
                <td className="py-2 px-4 text-left">{getAssociationName(product.brandId, brands)}</td>
                <td className="py-2 px-4 text-left">{getAssociationName(product.categoryId, categories)}</td>
                <td className="py-2 px-4 text-left">{getAssociationName(product.supplierId, suppliers)}</td>
                <td className="py-2 px-4 text-right">R {product.purchasePrice.toFixed(2)}</td>                <td className="py-2 px-4 text-right">R {product.sellPrice.toFixed(2)}</td>
                <td className="py-2 px-4 text-right">{product.stockQty}</td>
                <td className="py-2 px-4 text-center">
                  <div className="flex item-center justify-center space-x-2">
                    <button
                      onClick={() => openEditModal(product)}
                      disabled={isSubmitting}
                      className="text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
                      title="Edit Product"
                    >
                      <FiEdit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id, product.imagePath)}
                      disabled={isSubmitting}
                      className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
                      title="Delete Product"
                    >
                      <FiTrash2 size={16} />
                    </button>                    <button
                      onClick={() => handleAddToPurchaseOrder(product)}
                      disabled={isSubmitting}
                      className="text-green-600 hover:text-green-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed p-2 hover:bg-green-100 rounded-full group"
                      title="Add to Purchase Order"
                    >
                      <div className="relative">
                        <FiShoppingCart size={18} className="group-hover:scale-110 transition-transform" />
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProducts.length > entriesToShow && (
          <div className="py-3 px-4 text-center">
            <button
              onClick={() => setEntriesToShow(prev => prev + 10)}
              className="text-blue-600 hover:underline text-sm"
              disabled={isSubmitting}
            >
              Load More
            </button>
          </div>        )}
      </div>      {isEditModalOpen && selectedProductForEdit && (        <EditProductModal
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
  );
};

export default ProductPage;
