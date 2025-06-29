'use client';

import React, { useState, useEffect } from 'react';
import { FiPackage, FiLoader, FiAlertCircle, FiCheck, FiArrowRight, FiImage, FiTruck, FiCheckCircle, FiEdit3, FiRotateCcw, FiPlus, FiSave, FiX } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, where, Timestamp, addDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { PurchaseOrderItem, Purchase, Product, Supplier } from '@/types/pos';
import POSLayout from '@/components/admin/POSLayout';

const PurchaseOrderPage = () => {
  const { currentUser } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'received'>('all');
  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);
  
  // Editing states
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editPrice, setEditPrice] = useState<number>(0);
  
  // Add new item states
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [newItemPrice, setNewItemPrice] = useState<number>(0);  useEffect(() => {
    if (!currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    // Fetch purchase orders
    const poRef = collection(db, `admins/${currentUser.uid}/purchase_orders`);
    const poQuery = query(poRef, orderBy('createdAt', 'desc'));
    
    const unsubscribePO = onSnapshot(poQuery, (querySnapshot) => {
      const ordersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPurchaseOrders(ordersList);
    }, (err) => {
      console.error("Error fetching purchase orders:", err);
    });

    // Fetch purchase order items (for when viewing items within a PO)
    const itemsRef = collection(db, `admins/${currentUser.uid}/purchase_order_items`);
    const itemsQuery = query(
      itemsRef, 
      where('status', 'in', ['ordered', 'received']), 
      orderBy('dateAdded', 'desc')
    );
    
    const unsubscribeItems = onSnapshot(itemsQuery, (querySnapshot) => {
      const itemsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as PurchaseOrderItem[];
      setPurchaseOrderItems(itemsList);
    }, (err) => {
      console.error("Error fetching purchase order items:", err);
    });

    // Fetch products
    const productsRef = collection(db, `admins/${currentUser.uid}/pos_products`);
    const productsQuery = query(productsRef, orderBy('name', 'asc'));
    
    const unsubscribeProducts = onSnapshot(productsQuery, (querySnapshot) => {
      const productsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(productsList);
    });

    // Fetch suppliers
    const suppliersRef = collection(db, `admins/${currentUser.uid}/suppliers`);
    const suppliersQuery = query(suppliersRef, orderBy('name', 'asc'));
    
    const unsubscribeSuppliers = onSnapshot(suppliersQuery, (querySnapshot) => {
      const suppliersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Supplier[];
      setSuppliers(suppliersList);
      setIsLoading(false);
    });    return () => {
      unsubscribePO();
      unsubscribeItems();
      unsubscribeProducts();
      unsubscribeSuppliers();
    };
  }, [currentUser]);
  const handleMarkAsReceived = async (itemId: string) => {
    if (!currentUser?.uid) return;
    if (!confirm('Mark this item as received? This will update stock levels and create a purchase record.')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const itemRef = doc(db, `admins/${currentUser.uid}/purchase_order_items`, itemId);
      const itemDoc = await getDoc(itemRef);
      
      if (!itemDoc.exists()) {
        throw new Error('Purchase order item not found');
      }

      const itemData = itemDoc.data() as PurchaseOrderItem;
      const now = Timestamp.now();

      // Update purchase order item status
      await updateDoc(itemRef, {
        status: 'received',
        receivedAt: now,
        updatedAt: now
      });

      // Create purchase record
      const purchaseData: Omit<Purchase, 'id'> = {
        purchaseOrderItemId: itemId,
        productId: itemData.productId,
        productName: itemData.productName,
        productSku: itemData.productSku,
        productBarcode: itemData.productBarcode,
        brandId: itemData.brandId,
        brandName: itemData.brandName,
        categoryId: itemData.categoryId,
        categoryName: itemData.categoryName,
        supplierId: itemData.supplierId,
        supplierName: itemData.supplierName,
        purchasePrice: itemData.purchasePrice,
        quantity: itemData.quantity,
        totalAmount: itemData.totalAmount,
        adminId: currentUser.uid,
        purchaseDate: itemData.dateAdded,
        receivedDate: now,
        createdAt: now
      };

      const purchasesRef = collection(db, `admins/${currentUser.uid}/purchases`);
      await addDoc(purchasesRef, purchaseData);

      // Update product stock quantity
      const productRef = doc(db, `admins/${currentUser.uid}/pos_products`, itemData.productId);
      const productDoc = await getDoc(productRef);
      
      if (productDoc.exists()) {
        const productData = productDoc.data();
        const currentStock = productData.stockQuantity || 0;
        const newStock = currentStock + itemData.quantity;
        
        await updateDoc(productRef, {
          stockQuantity: newStock,
          updatedAt: now
        });
      }

      console.log('Item marked as received, purchase record created, and stock updated successfully');
    } catch (err: any) {
      console.error("Error updating item status:", err);
      setError(`Failed to update item status: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveToPending = async (itemId: string) => {
    if (!currentUser?.uid) return;
    if (!confirm('Move this item back to pending purchase list?')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const itemRef = doc(db, `admins/${currentUser.uid}/purchase_order_items`, itemId);      await updateDoc(itemRef, {
        status: 'pending',
        purchaseOrderId: null,
        updatedAt: Timestamp.now()
      });console.log('Item moved back to pending successfully');
    } catch (err: any) {
      console.error("Error moving item to pending:", err);
      setError(`Failed to move item to pending: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (item: PurchaseOrderItem) => {
    setEditingItem(item.id);
    setEditQuantity(item.quantity);
    setEditPrice(item.purchasePrice);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditQuantity(1);
    setEditPrice(0);
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!currentUser?.uid || editQuantity < 1 || editPrice < 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const newTotalAmount = editQuantity * editPrice;
      const itemRef = doc(db, `admins/${currentUser.uid}/purchase_order_items`, itemId);
      
      await updateDoc(itemRef, {
        quantity: editQuantity,
        purchasePrice: editPrice,
        totalAmount: newTotalAmount,
        updatedAt: Timestamp.now()
      });

      // Update the associated purchase order totals
      const item = purchaseOrderItems.find(p => p.id === itemId);
      if (item?.purchaseOrderId) {
        await updatePurchaseOrderTotals(item.purchaseOrderId);
      }

      setEditingItem(null);
      console.log('Item updated successfully');
    } catch (err: any) {
      console.error("Error updating item:", err);
      setError(`Failed to update item: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePurchaseOrderTotals = async (purchaseOrderId: string) => {
    try {
      // Get all items for this purchase order
      const itemsQuery = query(
        collection(db, `admins/${currentUser!.uid}/purchase_order_items`),
        where('purchaseOrderId', '==', purchaseOrderId),
        where('status', '==', 'ordered')
      );
      
      const itemsSnapshot = await getDocs(itemsQuery);
      const items = itemsSnapshot.docs.map(doc => doc.data() as PurchaseOrderItem);
      
      const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
      const itemCount = items.length;
      
      // Update purchase order
      const poRef = doc(db, `admins/${currentUser!.uid}/purchase_orders`, purchaseOrderId);
      await updateDoc(poRef, {
        totalAmount,
        itemCount,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      console.error("Error updating purchase order totals:", err);
    }
  };

  const handleAddNewItem = async () => {
    if (!currentUser?.uid || !selectedProduct || !selectedSupplier || newItemQuantity < 1 || newItemPrice < 0) {
      setError('Please fill in all required fields with valid values.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const product = products.find(p => p.id === selectedProduct);
      const supplier = suppliers.find(s => s.id === selectedSupplier);
      
      if (!product || !supplier) {
        throw new Error('Selected product or supplier not found');
      }

      // Check for existing open purchase order with this supplier
      const existingPOQuery = query(
        collection(db, `admins/${currentUser.uid}/purchase_orders`),
        where('supplierId', '==', selectedSupplier),
        where('status', '==', 'open')
      );
      
      const existingPOSnapshot = await getDocs(existingPOQuery);
      let purchaseOrderId: string;
      
      if (!existingPOSnapshot.empty) {
        // Add to existing PO
        const existingPODoc = existingPOSnapshot.docs[0];
        purchaseOrderId = existingPODoc.id;
      } else {
        // Create new PO
        const newPOData = {
          supplierId: selectedSupplier,
          supplierName: supplier.name,
          status: 'open',
          itemCount: 0,
          totalAmount: 0,
          adminId: currentUser.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        const newPORef = await addDoc(collection(db, `admins/${currentUser.uid}/purchase_orders`), newPOData);
        purchaseOrderId = newPORef.id;
      }

      // Create new purchase order item
      const newItemData: Omit<PurchaseOrderItem, 'id'> = {
        productId: product.id,
        productName: product.name,
        productSku: product.sku || '',
        productBarcode: product.barcode,
        brandId: product.brandId,
        brandName: product.brandId ? 'Brand Name' : undefined,
        categoryId: product.categoryId,
        categoryName: product.categoryId ? 'Category Name' : undefined,
        supplierId: selectedSupplier,
        supplierName: supplier.name,
        purchasePrice: newItemPrice,
        quantity: newItemQuantity,
        totalAmount: newItemPrice * newItemQuantity,
        adminId: currentUser.uid,        dateAdded: Timestamp.now(),
        status: 'ordered',
        purchaseOrderId: purchaseOrderId,
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, `admins/${currentUser.uid}/purchase_order_items`), newItemData);

      // Update purchase order totals
      await updatePurchaseOrderTotals(purchaseOrderId);

      // Reset form
      setShowAddItemModal(false);
      setSelectedProduct('');
      setSelectedSupplier('');
      setNewItemQuantity(1);
      setNewItemPrice(0);

      console.log('New item added to purchase order successfully');
    } catch (err: any) {
      console.error("Error adding new item:", err);
      setError(`Failed to add new item: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewPO = (poId: string) => {
    setSelectedPO(poId);
    setShowItems(true);
  };

  const handleBackToPOList = () => {
    setSelectedPO(null);
    setShowItems(false);
  };

  const handleMarkPOAsReceived = async (poId: string) => {
    if (!currentUser?.uid) return;
    if (!confirm('Mark this entire Purchase Order as received? This will update all items and stock levels.')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Get all items for this PO
      const itemsQuery = query(
        collection(db, `admins/${currentUser.uid}/purchase_order_items`),
        where('purchaseOrderId', '==', poId),
        where('status', '==', 'ordered')
      );
      
      const itemsSnapshot = await getDocs(itemsQuery);
      const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PurchaseOrderItem[];

      // Mark each item as received
      for (const item of items) {
        await handleMarkAsReceived(item.id);
      }

      // Update PO status
      const poRef = doc(db, `admins/${currentUser.uid}/purchase_orders`, poId);
      await updateDoc(poRef, {
        status: 'received',
        receivedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      console.log('Purchase Order marked as received successfully');
    } catch (err: any) {
      console.error("Error marking PO as received:", err);
      setError(`Failed to mark PO as received: ${err.message || "Please try again."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ordered: { color: 'bg-blue-100 text-blue-800', icon: FiTruck, label: 'Ordered' },
      received: { color: 'bg-green-100 text-green-800', icon: FiCheckCircle, label: 'Received' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.ordered;
    const IconComponent = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <IconComponent className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };  const filteredPOs = purchaseOrders.filter(po => {
    if (statusFilter === 'all') return true;
    return po.status === statusFilter;
  });

  const selectedPOItems = selectedPO 
    ? purchaseOrderItems.filter(item => item.purchaseOrderId === selectedPO)
    : [];

  const totalPOs = purchaseOrders.length;
  const openPOs = purchaseOrders.filter(po => po.status === 'open').length;
  const receivedPOs = purchaseOrders.filter(po => po.status === 'received').length;
  const totalValue = purchaseOrders.reduce((sum, po) => sum + (po.totalAmount || 0), 0);

  if (!currentUser) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen flex flex-col items-center justify-center">
        <FiAlertCircle className="text-red-500 text-6xl mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Authentication Required</h2>
        <p className="text-gray-600">Please log in to view purchase orders.</p>
      </div>
    );
  }

  return (
    <POSLayout
      pageTitle="Purchase Orders"
      pageDescription="Track and manage confirmed purchase orders from suppliers. Monitor delivery status and stock updates."
      breadcrumbs={[
        { label: 'Purchase System' },
        { label: 'Purchase Orders' }
      ]}
    >
      <div className="p-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-slate-600">
            Total Orders: {totalPOs}
          </div>
          <button
            onClick={() => setShowAddItemModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <FiPlus size={16} />
            Add New Item
          </button>
        </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
          <div className="flex items-center">
            <FiAlertCircle className="mr-3 text-red-500" size={20} />
            <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Enhanced Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiPackage className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Total POs</div>
                <div className="text-2xl font-bold text-slate-900">{totalPOs}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiTruck className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Open POs</div>
                <div className="text-2xl font-bold text-slate-900">{openPOs}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiCheckCircle className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Received POs</div>
                <div className="text-2xl font-bold text-slate-900">{receivedPOs}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiArrowRight className="text-blue-600 text-xl mr-3" />
              <div>
                <div className="text-sm text-slate-600">Total Value</div>
                <div className="text-2xl font-bold text-slate-900">R {totalValue.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6 border border-slate-200">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex-1 text-center ${
                statusFilter === 'all'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              All POs ({totalPOs})
            </button>
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex-1 text-center ${
                statusFilter === 'open'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Open POs ({openPOs})
            </button>
            <button
              onClick={() => setStatusFilter('received')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex-1 text-center ${
                statusFilter === 'received'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Received POs ({receivedPOs})
            </button>
          </div>
        </div>

        {/* Main Content Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
          {/* Table Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {showItems ? `Purchase Order Items (${selectedPOItems.length})` : `Purchase Orders (${filteredPOs.length})`}
                </h2>
                <p className="text-slate-600 text-sm mt-1">
                  {showItems 
                    ? 'Items in selected purchase order'
                    : 'Purchase orders grouped by supplier - click to view items'
                  }
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {showItems && (
                  <button
                    onClick={handleBackToPOList}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <FiArrowRight className="rotate-180" size={16} />
                    Back to POs
                  </button>
                )}
                <div className="text-right">
                  <div className="text-sm text-slate-600">Total Value</div>
                  <div className="text-2xl font-bold text-slate-900">
                    R {showItems 
                      ? selectedPOItems.reduce((sum, item) => sum + item.totalAmount, 0).toFixed(2)
                      : filteredPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0).toFixed(2)
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-blue-50 to-green-50">
                <tr>
                  {showItems ? (
                    <>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <FiPackage size={14} />
                          Product Details
                        </div>
                      </th>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Brand</th>
                      <th className="py-4 px-6 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                      <th className="py-4 px-6 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantity</th>
                      <th className="py-4 px-6 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                      <th className="py-4 px-6 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="py-4 px-6 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </>
                  ) : (
                    <>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <FiTruck size={14} />
                          Supplier
                        </div>
                      </th>
                      <th className="py-4 px-6 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Items</th>
                      <th className="py-4 px-6 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Value</th>
                      <th className="py-4 px-6 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="py-4 px-6 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                      <th className="py-4 px-6 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading && (
                  <tr>
                    <td colSpan={showItems ? 7 : 6} className="py-16 px-6 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-green-400 rounded-full flex items-center justify-center mb-4">
                          <FiLoader className="animate-spin text-2xl text-white" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-700">Loading {showItems ? 'items' : 'purchase orders'}...</h3>
                        <p className="text-gray-500 mt-1">Please wait while we fetch your data</p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Show Purchase Orders */}
                {!isLoading && !showItems && filteredPOs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 px-6 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center mb-4">
                          <FiPackage className="text-4xl text-blue-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No purchase orders found</h3>
                        <p className="text-gray-500 mb-4 max-w-md">
                          {statusFilter === 'all' 
                            ? 'Create purchase orders from your pending purchase list to start tracking deliveries.'
                            : `No purchase orders with "${statusFilter}" status found.`
                          }
                        </p>
                        <div className="flex gap-3">
                          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                            View Pending Items
                          </button>
                          {statusFilter !== 'all' && (
                            <button 
                              onClick={() => setStatusFilter('all')}
                              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            >
                              Show All POs
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && !showItems && filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-green-50 transition-all duration-200 border-b border-gray-100 cursor-pointer">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <FiTruck className="text-white text-lg" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-lg">{po.supplierName}</div>
                          <div className="text-xs text-gray-500">PO ID: {po.id.slice(-8).toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-lg font-bold text-gray-900">{po.itemCount || 0}</div>
                      <div className="text-xs text-gray-500">items</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-xl font-bold text-green-600">R {(po.totalAmount || 0).toFixed(2)}</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {po.status === 'open' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <FiTruck className="w-3 h-3 mr-1" />
                          Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <FiCheckCircle className="w-3 h-3 mr-1" />
                          Received
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">
                        {po.createdAt?.toDate ? po.createdAt.toDate().toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewPO(po.id)}
                          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                          title="View Items"
                        >
                          <FiPackage size={14} />
                        </button>
                        {po.status === 'open' && (
                          <button
                            onClick={() => handleMarkPOAsReceived(po.id)}
                            disabled={isSubmitting}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                            title="Mark as Received"
                          >
                            <FiCheck size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Show Items in selected PO */}
                {!isLoading && showItems && selectedPOItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 px-6 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center mb-4">
                          <FiPackage className="text-4xl text-blue-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No items found</h3>
                        <p className="text-gray-500 mb-4 max-w-md">This purchase order doesn't have any items yet.</p>
                        <button 
                          onClick={handleBackToPOList}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          Back to Purchase Orders
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && showItems && selectedPOItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-green-50 transition-all duration-200 border-b border-gray-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm">
                          <FiImage className="text-gray-400 text-xl" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 text-lg">{item.productName}</div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">SKU: {item.productSku}</span>
                            {item.productBarcode && (
                              <span className="text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded-full">BC: {item.productBarcode}</span>
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
                    <td className="py-4 px-6 text-right">
                      {editingItem === item.id ? (
                        <div className="flex items-center justify-end">
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            min="0"
                            step="0.01"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="text-lg font-bold text-gray-900">R {item.purchasePrice.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">per unit</div>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {editingItem === item.id ? (
                        <div className="flex items-center justify-end">
                          <input
                            type="number"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(Number(e.target.value))}
                            min="1"
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="text-lg font-bold text-gray-900">{item.quantity}</div>
                          <div className="text-xs text-gray-500">units</div>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-xl font-bold text-green-600">
                        R {editingItem === item.id 
                          ? (editQuantity * editPrice).toFixed(2) 
                          : item.totalAmount.toFixed(2)
                        }
                      </div>
                      <div className="text-xs text-gray-500">
                        {editingItem === item.id 
                          ? `${editQuantity} × R ${editPrice.toFixed(2)}`
                          : `${item.quantity} × R ${item.purchasePrice.toFixed(2)}`
                        }
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {editingItem === item.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={isSubmitting}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                            title="Save Changes"
                          >
                            <FiSave size={14} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
                            title="Cancel Edit"
                          >
                            <FiX size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          {item.status === 'ordered' && (
                            <>
                              <button
                                onClick={() => handleStartEdit(item)}
                                disabled={isSubmitting}
                                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                                title="Edit Item"
                              >
                                <FiEdit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleMoveToPending(item.id)}
                                disabled={isSubmitting}
                                className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition-colors"
                                title="Move to Pending"
                              >
                                <FiRotateCcw size={14} />
                              </button>
                              <button
                                onClick={() => handleMarkAsReceived(item.id)}
                                disabled={isSubmitting}
                                className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                                title="Mark as Received"
                              >
                                <FiCheck size={14} />
                              </button>
                            </>
                          )}
                          {item.status === 'received' && (
                            <div className="flex items-center justify-center gap-2 text-green-600">
                              <FiCheckCircle size={16} />
                              <span className="text-sm font-medium">Complete</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          {!isLoading && (
            <div className="bg-gradient-to-r from-blue-50 to-green-50 px-6 py-4 border-t border-blue-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-blue-800">
                  {showItems ? (
                    <>
                      <span className="font-semibold">{selectedPOItems.length}</span> items in this purchase order
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">{filteredPOs.length}</span> purchase orders
                      {statusFilter !== 'all' && <span> ({statusFilter} status)</span>}
                    </>
                  )}
                </div>
                <div className="text-sm text-blue-600">
                  Total Value: <span className="font-bold">
                    R {showItems 
                      ? selectedPOItems.reduce((sum, item) => sum + item.totalAmount, 0).toFixed(2)
                      : filteredPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0).toFixed(2)
                    }
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Add New Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Add New Item to PO</h3>
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Product Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product *
                  </label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a product...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} {product.sku ? `(${product.sku})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supplier Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier *
                  </label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a supplier...</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(Number(e.target.value))}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter quantity"
                  />
                </div>

                {/* Purchase Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purchase Price (R) *
                  </label>
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter price per unit"
                  />
                </div>

                {/* Total Amount Display */}
                {newItemQuantity > 0 && newItemPrice > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm text-blue-600 font-medium">
                      Total Amount: R {(newItemQuantity * newItemPrice).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAddNewItem}
                  disabled={isSubmitting || !selectedProduct || !selectedSupplier || newItemQuantity < 1 || newItemPrice < 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <FiLoader className="animate-spin" size={16} />
                      Adding...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <FiPlus size={16} />
                      Add Item
                    </div>
                  )}
                </button>
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </POSLayout>
  );
};

export default PurchaseOrderPage;
