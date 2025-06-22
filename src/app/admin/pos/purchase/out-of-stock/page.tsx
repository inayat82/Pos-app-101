'use client';

import React, { useState, useEffect } from 'react';
import { FiAlertTriangle, FiLoader, FiAlertCircle, FiArrowRight, FiPackage, FiRotateCcw, FiTrash2, FiClock } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { PurchaseOrderItem } from '@/types/pos';

interface OutOfStockItem extends PurchaseOrderItem {
  dateMarkedOutOfStock: any; // Timestamp
}

const OutOfStockPage = () => {
  const { currentUser } = useAuth();
  const [outOfStockItems, setOutOfStockItems] = useState<OutOfStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    // Fetch out of stock items
    const collRef = collection(db, `admins/${currentUser.uid}/out_of_stock_items`);
    const q = query(collRef, orderBy('dateMarkedOutOfStock', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const itemsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as OutOfStockItem[];
      setOutOfStockItems(itemsList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching out of stock items:", error);
      setError("Failed to fetch out of stock items. Please try again.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleReorderItem = async (item: OutOfStockItem) => {
    if (!currentUser?.uid) {
      setError("User not authenticated.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Move back to pending purchase list
      const pendingItem: Omit<PurchaseOrderItem, 'id'> = {
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productBarcode: item.productBarcode,
        brandId: item.brandId,
        brandName: item.brandName,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        purchasePrice: item.purchasePrice,
        quantity: item.quantity,
        totalAmount: item.totalAmount,
        adminId: currentUser.uid,
        dateAdded: Timestamp.now(),
        status: 'pending'
      };

      // Add back to pending items
      await addDoc(collection(db, `admins/${currentUser.uid}/purchase_order_items`), pendingItem);
      
      // Remove from out of stock items
      await deleteDoc(doc(db, `admins/${currentUser.uid}/out_of_stock_items`, item.id));

      alert(`✅ "${item.productName}" has been moved back to the pending purchase list.`);
      
    } catch (err: any) {
      console.error("Error reordering item:", err);
      setError(`Failed to reorder item: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (!currentUser?.uid) return;
    
    if (!confirm(`Are you sure you want to permanently delete "${itemName}" from the out of stock list?`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await deleteDoc(doc(db, `admins/${currentUser.uid}/out_of_stock_items`, itemId));
      alert(`✅ "${itemName}" has been permanently deleted from the out of stock list.`);
    } catch (err: any) {
      console.error("Error deleting item:", err);
      setError(`Failed to delete item: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen flex flex-col items-center justify-center">
        <FiAlertCircle className="text-red-500 text-6xl mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Authentication Required</h2>
        <p className="text-gray-600">Please log in to view your out of stock items.</p>
      </div>
    );
  }  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="w-full px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-500 mb-3">
                <FiAlertTriangle className="text-orange-600" size={16} />
                <span>Purchase System</span>
                <FiArrowRight size={14} />
                <span className="text-orange-600 font-medium">Out of Stock</span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Out of Stock Items</h1>
              <p className="text-lg text-gray-600 max-w-2xl">Items that were marked as out of stock and need immediate attention for restocking.</p>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="text-right">
                <div className="text-3xl font-bold text-orange-600">{outOfStockItems.length}</div>
                <div className="text-sm text-gray-500">Items Out of Stock</div>
              </div>
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                <FiAlertTriangle className="text-white" size={24} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8">        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
            <div className="flex items-center">
              <FiAlertCircle className="mr-3 text-red-500" size={20} />
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-orange-400 to-red-400 rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg">
                <FiLoader className="animate-spin text-3xl text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Loading out of stock items...</h3>
              <p className="text-gray-500">Checking inventory status</p>
            </div>
          </div>
        ) : outOfStockItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border">
            <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mb-6 mx-auto">
              <FiPackage className="text-4xl text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">Great! No Out of Stock Items</h3>
            <p className="text-lg text-gray-600 mb-6 max-w-md mx-auto">Your inventory is well-stocked. All items are available for purchase.</p>
            <div className="flex justify-center gap-4">
              <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                View Inventory
              </button>
              <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                Add Products
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border">
            {/* Table Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-orange-600 to-red-600 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Out of Stock Items ({outOfStockItems.length})
                  </h2>
                  <p className="text-orange-100 text-sm mt-1">
                    Items requiring immediate restocking attention
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-orange-100">Critical Items</div>
                    <div className="text-2xl font-bold text-white">
                      {outOfStockItems.length}
                    </div>
                  </div>
                  <button className="bg-white text-orange-600 px-4 py-2 rounded-lg font-medium hover:bg-orange-50 transition-colors">
                    Restock All
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-orange-50 to-red-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <FiPackage size={14} />
                        Product Details
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Brand</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Last Price</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <FiClock size={14} />
                        Date Marked
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {outOfStockItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-all duration-200 group">
                      <td className="px-6 py-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center border border-orange-200 group-hover:shadow-md transition-shadow">
                            <FiAlertTriangle className="text-orange-600" size={20} />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-lg group-hover:text-orange-700 transition-colors">{item.productName}</div>
                            <div className="text-sm text-gray-500">ID: {item.productId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {item.productSku}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <span className="text-sm font-medium text-gray-900">{item.brandName || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-6">
                        <span className="text-sm font-medium text-gray-900">{item.categoryName || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-6">
                        <div className="text-lg font-bold text-gray-900">R {item.purchasePrice.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-6">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                          {item.quantity} units
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center text-sm text-gray-600">
                          <FiClock className="text-gray-400 mr-2" size={14} />
                          {item.dateMarkedOutOfStock?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleReorderItem(item)}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move back to pending purchase list"
                          >
                            <div className="flex items-center gap-2">
                              <FiRotateCcw size={14} />
                              Reorder
                            </div>
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.productName)}
                            disabled={isSubmitting}
                            className="p-2 text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-100 rounded-lg"
                            title="Permanently delete item"
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
            
            {/* Summary Footer */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 px-6 py-4 border-t border-orange-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-orange-800">
                  <span className="font-semibold">{outOfStockItems.length}</span> items marked as out of stock
                </div>
                <div className="text-sm text-orange-600">
                  Use the reorder button to move items back to pending purchase list
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutOfStockPage;
