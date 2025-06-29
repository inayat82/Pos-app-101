
'use client';

import React, { useState, useEffect } from 'react';
import { FiShoppingCart, FiLoader, FiAlertCircle, FiCheck, FiArrowRight, FiImage, FiEdit3, FiAlertTriangle, FiPackage, FiTruck, FiDollarSign } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, where, Timestamp, addDoc, getDocs } from 'firebase/firestore';
import { PurchaseOrderItem, PurchaseOrder, Supplier } from '@/types/pos';
import PurchaseActionModal from '@/components/admin/PurchaseActionModal';
import POSLayout from '@/components/admin/POSLayout';

const PendingPurchasePage = () => {
  const { currentUser } = useAuth();  const [pendingItems, setPendingItems] = useState<PurchaseOrderItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(1);
  
  // New enhanced modal states
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PurchaseOrderItem | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setIsLoading(false);
      return;
    }    // Fetch suppliers
    const suppliersRef = collection(db, `admins/${currentUser.uid}/suppliers`);
    const suppliersQuery = query(suppliersRef, orderBy('name', 'asc'));
    
    const unsubscribeSuppliers = onSnapshot(suppliersQuery, (querySnapshot) => {
      const suppliersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Supplier[];
      console.log('Suppliers loaded:', suppliersList); // Debug log
      setSuppliers(suppliersList);
    }, (error) => {
      console.error("Error fetching suppliers:", error);
      setSuppliers([]);
    });

    // Only fetch items with 'pending' status
    const collRef = collection(db, `admins/${currentUser.uid}/purchase_order_items`);
    const q = query(collRef, where('status', '==', 'pending'), orderBy('dateAdded', 'desc'));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const itemsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as PurchaseOrderItem[];
      setPendingItems(itemsList);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching pending purchase items:", err);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeSuppliers();
    };
  }, [currentUser]);
  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (!currentUser?.uid || newQuantity < 1) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const item = pendingItems.find(p => p.id === itemId);
      if (!item) return;

      const newTotalAmount = item.purchasePrice * newQuantity;
      const itemRef = doc(db, `admins/${currentUser.uid}/purchase_order_items`, itemId);
      await updateDoc(itemRef, {
        quantity: newQuantity,
        totalAmount: newTotalAmount,
        updatedAt: Timestamp.now()
      });
      setEditingQuantity(null);
    } catch (err: any) {
      console.error("Error updating quantity:", err);
      setError(`Failed to update quantity: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleMarkAsOutOfStock = async (itemId: string) => {
    if (!currentUser?.uid) return;
    if (!confirm('Mark this item as out of stock?')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Find the item to be moved
      const item = pendingItems.find(p => p.id === itemId);
      if (!item) {
        setError("Item not found.");
        return;
      }

      // Move to out of stock items collection
      await addDoc(collection(db, `admins/${currentUser.uid}/out_of_stock_items`), {
        ...item,
        dateMarkedOutOfStock: Timestamp.now(),
        status: 'out_of_stock'
      });

      // Remove from pending items
      await deleteDoc(doc(db, `admins/${currentUser.uid}/purchase_order_items`, itemId));

      alert(`✅ "${item.productName}" has been marked as out of stock and moved to the Out of Stock list.`);
    } catch (err: any) {
      console.error("Error marking item as out of stock:", err);
      setError(`Failed to mark item as out of stock: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handlePurchaseAction = async (item: PurchaseOrderItem) => {
    if (!currentUser?.uid) {
      setError("User not authenticated.");
      return;
    }

    try {
      // Fetch purchase history for this product
      const historyRef = collection(db, `admins/${currentUser.uid}/purchase_history`);
      const historyQuery = query(
        historyRef, 
        where('productId', '==', item.productId),
        orderBy('purchaseDate', 'desc')
      );
      
      const historySnapshot = await getDocs(historyQuery);
      const history = historySnapshot.docs.map(doc => ({
        ...doc.data(),
        purchaseDate: doc.data().purchaseDate.toDate()
      }));

      setPurchaseHistory(history);
      setSelectedItem(item);
      setIsActionModalOpen(true);
    } catch (err: any) {
      console.error("Error fetching purchase history:", err);
      // If history fetch fails, still show modal with empty history
      setPurchaseHistory([]);
      setSelectedItem(item);
      setIsActionModalOpen(true);
    }
  };

  const handlePurchase = async (data: {
    supplierId: string;
    purchasePrice: number;
    quantity: number;
  }) => {
    if (!currentUser?.uid || !selectedItem) {
      throw new Error("User not authenticated or no item selected.");
    }

    setIsSubmitting(true);
    try {
      const { supplierId, purchasePrice, quantity } = data;
      const selectedSupplier = suppliers.find(s => s.id === supplierId);
      
      if (!selectedSupplier) {
        throw new Error("Selected supplier not found.");
      }

      // Check if there's an existing open purchase order for this supplier
      const existingPOQuery = query(
        collection(db, `admins/${currentUser.uid}/purchase_orders`),
        where('supplierId', '==', supplierId),
        where('status', '==', 'open')
      );
      
      const existingPOSnapshot = await getDocs(existingPOQuery);
      let purchaseOrderId: string;
      
      if (!existingPOSnapshot.empty) {
        // Add to existing PO
        const existingPODoc = existingPOSnapshot.docs[0];
        purchaseOrderId = existingPODoc.id;
        const existingPOData = existingPODoc.data() as PurchaseOrder;
          await updateDoc(doc(db, `admins/${currentUser.uid}/purchase_orders`, purchaseOrderId), {
          itemCount: (existingPOData.itemCount || 0) + 1,
          totalAmount: existingPOData.totalAmount + (purchasePrice * quantity),
          updatedAt: Timestamp.now()
        });      } else {
        // Create new PO
        const newPOData: Omit<PurchaseOrder, 'id'> = {
          supplierId: supplierId,
          supplierName: selectedSupplier.name,
          status: 'open',
          itemCount: 1,
          totalAmount: purchasePrice * quantity,
          adminId: currentUser.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        const newPORef = await addDoc(collection(db, `admins/${currentUser.uid}/purchase_orders`), newPOData);
        purchaseOrderId = newPORef.id;
      }

      // Update the pending item to purchased status
      await updateDoc(doc(db, `admins/${currentUser.uid}/purchase_order_items`, selectedItem.id), {
        status: 'ordered',
        purchaseOrderId: purchaseOrderId,
        quantity: quantity,
        purchasePrice: purchasePrice,
        totalAmount: purchasePrice * quantity,
        supplierId: supplierId,
        supplierName: selectedSupplier.name,
        datePurchased: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Add to purchase history
      await addDoc(collection(db, `admins/${currentUser.uid}/purchase_history`), {
        productId: selectedItem.productId,
        productName: selectedItem.productName,
        supplierId: supplierId,
        supplierName: selectedSupplier.name,
        purchasePrice: purchasePrice,
        quantity: quantity,
        purchaseDate: Timestamp.now(),
        purchaseOrderId: purchaseOrderId,
        adminId: currentUser.uid
      });

      alert(`✅ Purchase order created successfully!\n\nProduct: ${selectedItem.productName}\nQuantity: ${quantity}\nSupplier: ${selectedSupplier.name}\nTotal: $${(purchasePrice * quantity).toFixed(2)}`);
      
    } catch (err: any) {
      console.error("Error processing purchase:", err);
      throw new Error(`Failed to process purchase: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkOutOfStock = async () => {
    if (!currentUser?.uid || !selectedItem) {
      throw new Error("User not authenticated or no item selected.");
    }

    setIsSubmitting(true);
    try {
      // Move to out of stock items collection
      await addDoc(collection(db, `admins/${currentUser.uid}/out_of_stock_items`), {
        ...selectedItem,
        dateMarkedOutOfStock: Timestamp.now(),
        status: 'out_of_stock'
      });

      // Remove from pending items
      await deleteDoc(doc(db, `admins/${currentUser.uid}/purchase_order_items`, selectedItem.id));

      alert(`✅ "${selectedItem.productName}" has been marked as out of stock and moved to the Out of Stock list.`);
      
    } catch (err: any) {
      console.error("Error marking as out of stock:", err);
      throw new Error(`Failed to mark as out of stock: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }  };
  
  const startEditingQuantity = (itemId: string, currentQuantity: number) => {
    setEditingQuantity(itemId);
    setTempQuantity(currentQuantity);
  };

  const totalAmount = pendingItems.reduce((sum, item) => sum + item.totalAmount, 0);

  if (!currentUser) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen flex flex-col items-center justify-center">
        <FiAlertCircle className="text-red-500 text-6xl mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Authentication Required</h2>
        <p className="text-gray-600">Please log in to view your pending purchases.</p>
      </div>
    );
  }
  return (
    <POSLayout
      pageTitle="Pending Purchase List"
      pageDescription="Items you've added from the product catalog that are ready to be ordered."
      breadcrumbs={[
        { label: 'Purchase System' },
        { label: 'Pending Purchase' }
      ]}
    >
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            <div className="flex items-center">
              <FiAlertCircle className="mr-2" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiPackage className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Total Items</div>
                <div className="text-2xl font-bold text-slate-900">{pendingItems.length}</div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiDollarSign className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Total Value</div>
                <div className="text-2xl font-bold text-slate-900">R {totalAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Pending Items ({pendingItems.length})
                </h2>
                <p className="text-slate-600 text-sm mt-1">
                  Review and process your pending purchase orders
                </p>
              </div>
              {pendingItems.length > 0 && (
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Process All Orders
                </button>
              )}
            </div>
          </div>        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FiPackage size={14} />
                    Product Details
                  </div>
                </th>
                <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FiImage size={14} />
                    Brand
                  </div>
                </th>
                <th className="py-3 px-6 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FiTruck size={14} />
                    Supplier
                  </div>
                </th>
                <th className="py-3 px-6 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2">
                    <FiDollarSign size={14} />
                    Price
                  </div>
                </th>
                <th className="py-3 px-6 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2">
                    <FiShoppingCart size={14} />
                    Quantity
                  </div>
                </th>
                <th className="py-3 px-6 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2">
                    <FiCheck size={14} />
                    Total
                  </div>
                </th>
                <th className="py-3 px-6 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">              {isLoading && (
                <tr>
                  <td colSpan={7} className="py-16 px-6 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
                        <FiLoader className="animate-spin text-2xl text-white" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-700">Loading pending purchase items...</h3>
                      <p className="text-slate-500 mt-1">Please wait while we fetch your items</p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && pendingItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 px-6 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <FiShoppingCart className="text-4xl text-slate-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-700 mb-2">No pending purchase items</h3>
                      <p className="text-slate-500 mb-4 max-w-md">
                        Start by adding products from the Product Management page using the cart button, 
                        or check your Out of Stock items that need restocking.
                      </p>
                      <div className="flex gap-3">
                        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                          Browse Products
                        </button>
                        <button className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">
                          Check Out of Stock
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}              {!isLoading && pendingItems.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50 transition-colors border-b border-slate-100">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                        <FiImage className="text-slate-400 text-xl" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 text-lg">{item.productName}</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">SKU: {item.productSku}</span>
                          {item.productBarcode && (
                            <span className="text-xs text-slate-600 bg-blue-100 px-2 py-1 rounded-full">BC: {item.productBarcode}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {item.brandName || 'N/A'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-800">
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="text-lg font-bold text-slate-900">R {item.purchasePrice.toFixed(2)}</div>
                    <div className="text-xs text-slate-500">per unit</div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    {editingQuantity === item.id ? (
                      <div className="flex items-center justify-end space-x-2">
                        <input
                          type="number"
                          min="1"
                          value={tempQuantity}
                          onChange={(e) => setTempQuantity(parseInt(e.target.value) || 1)}
                          className="w-20 px-3 py-2 text-sm border-2 border-blue-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateQuantity(item.id, tempQuantity)}
                          disabled={isSubmitting}
                          className="text-green-600 hover:text-green-800 p-2 hover:bg-green-100 rounded-full transition-colors"
                          title="Save"
                        >
                          <FiCheck size={16} />
                        </button>
                        <button
                          onClick={() => setEditingQuantity(null)}
                          className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"
                          title="Cancel"
                        >
                          <FiArrowRight size={16} className="transform rotate-90" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end space-x-2">
                        <div className="text-right">
                          <div className="text-lg font-bold text-slate-900">{item.quantity}</div>
                          <div className="text-xs text-slate-500">units</div>
                        </div>
                        <button
                          onClick={() => startEditingQuantity(item.id, item.quantity)}
                          disabled={isSubmitting}
                          className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-100 rounded-full transition-colors"
                          title="Edit Quantity"
                        >
                          <FiEdit3 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="text-xl font-bold text-slate-900">R {item.totalAmount.toFixed(2)}</div>
                    <div className="text-xs text-slate-500">{item.quantity} × R {item.purchasePrice.toFixed(2)}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handlePurchaseAction(item)}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        title="Purchase"
                      >
                        <div className="flex items-center gap-2">
                          <FiShoppingCart size={14} />
                          Purchase
                        </div>
                      </button>
                      <button
                        onClick={() => handleMarkAsOutOfStock(item.id)}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors font-medium"
                        title="Mark as Out of Stock"
                      >
                        <div className="flex items-center gap-2">
                          <FiAlertTriangle size={14} />
                          Out of Stock
                        </div>
                      </button>
                    </div>
                  </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>        </div>

        {/* Enhanced Purchase Action Modal */}
        {isActionModalOpen && selectedItem && (
          <PurchaseActionModal
            isOpen={isActionModalOpen}
            onClose={() => {
              setIsActionModalOpen(false);
              setSelectedItem(null);
              setPurchaseHistory([]);
              setError(null);
            }}
            item={selectedItem}
            suppliers={suppliers}
            purchaseHistory={purchaseHistory}
            onPurchase={handlePurchase}
            onMarkOutOfStock={handleMarkOutOfStock}
            isLoading={isSubmitting}
          />
        )}
      </div>
    </POSLayout>
  );
};

export default PendingPurchasePage;
