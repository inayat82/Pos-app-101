'use client';

import React, { useState, useEffect } from 'react';
import { FiAlertTriangle, FiLoader, FiAlertCircle, FiArrowRight, FiPackage, FiRotateCcw, FiTrash2, FiClock, FiDollarSign } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { PurchaseOrderItem } from '@/types/pos';
import POSLayout from '@/components/admin/POSLayout';

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
  }

  return (
    <POSLayout
      pageTitle="Out of Stock Items"
      pageDescription="Items that were marked as out of stock and need immediate attention for restocking."
      breadcrumbs={[
        { label: 'Purchase System' },
        { label: 'Out of Stock' }
      ]}
    >
      <div className="p-6">        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
            <div className="flex items-center">
              <FiAlertCircle className="mr-3 text-red-500" size={20} />
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <FiAlertTriangle className="text-blue-600 text-xl mr-3" />
            <div>
              <div className="text-sm text-slate-600">Items Needing Restock</div>
              <div className="text-2xl font-bold text-slate-900">{outOfStockItems.length}</div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <FiLoader className="animate-spin text-3xl text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Loading out of stock items...</h3>
              <p className="text-slate-500">Checking inventory status</p>
            </div>
          </div>
        ) : outOfStockItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-slate-200">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <FiPackage className="text-4xl text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">Great! No Out of Stock Items</h3>
            <p className="text-lg text-slate-600 mb-6 max-w-md mx-auto">Your inventory is well-stocked. All items are available for purchase.</p>
            <div className="flex justify-center gap-4">
              <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                View Inventory
              </button>
              <button className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">
                Add Products
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
            {/* Table Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Out of Stock Items ({outOfStockItems.length})
                  </h2>
                  <p className="text-slate-600 text-sm mt-1">
                    Items requiring immediate restocking attention
                  </p>
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Restock All
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <FiPackage size={14} />
                        Product Details
                      </div>
                    </th>
                    <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">SKU</th>
                    <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Brand</th>
                    <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Category</th>
                    <th className="py-3 px-6 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-2">
                        <FiDollarSign size={14} />
                        Price
                      </div>
                    </th>
                    <th className="py-3 px-6 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-2">
                        <FiPackage size={14} />
                        Quantity
                      </div>
                    </th>
                    <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <FiClock size={14} />
                        Date Marked
                      </div>
                    </th>
                    <th className="py-3 px-6 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {outOfStockItems.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50 transition-colors border-b border-slate-100">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                            <FiAlertTriangle className="text-blue-600" size={20} />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-slate-900 text-lg">{item.productName}</div>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">ID: {item.productId}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {item.productSku}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-800">
                          {item.brandName || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm font-medium text-slate-900">{item.categoryName || 'N/A'}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-lg font-bold text-slate-900">R {item.purchasePrice.toFixed(2)}</div>
                        <div className="text-sm text-slate-500">per unit</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-lg font-semibold text-slate-900">{item.quantity}</div>
                        <div className="text-sm text-slate-500">units</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-slate-600">
                          {item.dateMarkedOutOfStock?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleReorderItem(item)}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
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
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors disabled:opacity-50 rounded-lg"
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
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-800">
                  <span className="font-semibold">{outOfStockItems.length}</span> items marked as out of stock
                </div>
                <div className="text-sm text-slate-600">
                  Use the reorder button to move items back to pending purchase list
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </POSLayout>
  );
};

export default OutOfStockPage;
