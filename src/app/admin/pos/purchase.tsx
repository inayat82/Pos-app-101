'use client';

import React, { useState, useEffect } from 'react';
import { FiShoppingCart, FiLoader, FiAlertCircle, FiTrash2, FiCheck, FiPackage } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { PurchaseOrderItem } from '@/types/pos';

const ProductPurchasePage = () => {
  const { currentUser } = useAuth();
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    const collRef = collection(db, `admins/${currentUser.uid}/purchase_order_items`);
    const q = query(collRef, orderBy('dateAdded', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const itemsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as PurchaseOrderItem[];
      setPurchaseOrderItems(itemsList);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching purchase order items:", err);
      setError("Failed to fetch purchase order items. Please try again.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleUpdateStatus = async (itemId: string, newStatus: 'pending' | 'ordered' | 'received') => {
    if (!currentUser?.uid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const itemRef = doc(db, `admins/${currentUser.uid}/purchase_order_items`, itemId);
      await updateDoc(itemRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
    } catch (err: any) {
      console.error("Error updating item status:", err);
      setError(`Failed to update item status: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!currentUser?.uid) return;
    if (!confirm('Are you sure you want to remove this item from your purchase order?')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await deleteDoc(doc(db, `admins/${currentUser.uid}/purchase_order_items`, itemId));
    } catch (err: any) {
      console.error("Error deleting item:", err);
      setError(`Failed to delete item: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: FiShoppingCart },
      ordered: { color: 'bg-blue-100 text-blue-800', icon: FiCheck },
      received: { color: 'bg-green-100 text-green-800', icon: FiPackage }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const IconComponent = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <IconComponent className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const totalAmount = purchaseOrderItems.reduce((sum, item) => sum + item.totalAmount, 0);

  if (!currentUser) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen flex flex-col items-center justify-center">
        <FiAlertCircle className="text-red-500 text-6xl mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Authentication Required</h2>
        <p className="text-gray-600">Please log in to manage purchase orders.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Purchase Order System</h1>
          <p className="text-gray-600">Manage your product purchase orders and track their status.</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="flex items-center">
              <FiAlertCircle className="mr-2" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Purchase Order Items</h2>
              <div className="text-lg font-bold text-gray-800">
                Total: R {totalAmount.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="py-10 px-4 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <FiLoader className="animate-spin text-4xl mb-2" />
                        <span>Loading purchase order items...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && purchaseOrderItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 px-4 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <FiShoppingCart className="text-6xl mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No items in purchase order</p>
                        <p className="text-sm">Add products from the Product Management page to get started.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && purchaseOrderItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                    <td className="py-2 px-4">
                      <div className="font-medium text-gray-800">{item.productName}</div>
                      <div className="text-xs text-gray-500">SKU: {item.productSku}</div>
                      {item.productBarcode && <div className="text-xs text-gray-500">BC: {item.productBarcode}</div>}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-600">{item.brandName || 'N/A'}</td>
                    <td className="py-2 px-4 text-sm text-gray-600">{item.supplierName || 'N/A'}</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-800">R {item.purchasePrice.toFixed(2)}</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-800">{item.quantity}</td>
                    <td className="py-2 px-4 text-right text-sm font-medium text-gray-800">R {item.totalAmount.toFixed(2)}</td>
                    <td className="py-2 px-4 text-center">{getStatusBadge(item.status)}</td>
                    <td className="py-2 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {item.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'ordered')}
                            disabled={isSubmitting}
                            className="text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
                            title="Mark as Ordered"
                          >
                            <FiCheck size={16} />
                          </button>
                        )}
                        {item.status === 'ordered' && (
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'received')}
                            disabled={isSubmitting}
                            className="text-green-600 hover:text-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
                            title="Mark as Received"
                          >
                            <FiPackage size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={isSubmitting}
                          className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
                          title="Remove Item"
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
        </div>

        {purchaseOrderItems.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => purchaseOrderItems.filter(item => item.status === 'pending').forEach(item => handleUpdateStatus(item.id, 'ordered'))}
                disabled={isSubmitting || !purchaseOrderItems.some(item => item.status === 'pending')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark All Pending as Ordered
              </button>
              <button
                onClick={() => purchaseOrderItems.filter(item => item.status === 'ordered').forEach(item => handleUpdateStatus(item.id, 'received'))}
                disabled={isSubmitting || !purchaseOrderItems.some(item => item.status === 'ordered')}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark All Ordered as Received
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPurchasePage;
