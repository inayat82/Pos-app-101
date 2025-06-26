import { db } from '@/lib/firebase/firebase';
import { 
  collection, query, where, getDocs, deleteDoc, doc, 
  addDoc, serverTimestamp, writeBatch, orderBy, limit
} from 'firebase/firestore';

interface CleanupResult {
  removed?: number;
  deleted?: number;
  success: boolean;
  message: string;
}

// Log activity to the current log table
async function logActivity(integrationId: string, action: string, details: string, status: 'success' | 'error') {
  try {
    await addDoc(collection(db, 'takealot_logs'), {
      integrationId,
      action,
      details,
      status,
      timestamp: serverTimestamp(),
      type: 'data_cleanup'
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// Cleanup duplicate products by TSIN
export async function cleanupDuplicateProducts(integrationId: string): Promise<CleanupResult> {
  try {
    const productsRef = collection(db, 'takealot_products');
    const q = query(productsRef, where('integrationId', '==', integrationId));
    const snapshot = await getDocs(q);
    
    const tsinGroups: { [tsin: string]: any[] } = {};
    
    // Group products by TSIN
    snapshot.docs.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const tsin = data.tsin || data.TSIN;
      if (tsin) {
        if (!tsinGroups[tsin]) {
          tsinGroups[tsin] = [];
        }
        tsinGroups[tsin].push({ id: docSnapshot.id, data });
      }
    });
    
    let removedCount = 0;
    const batch = writeBatch(db);
    
    // For each TSIN group, keep the most recent and delete duplicates
    Object.values(tsinGroups).forEach(products => {
      if (products.length > 1) {
        // Sort by createdAt/updatedAt and keep the newest
        products.sort((a, b) => {
          const timeA = a.data.updatedAt || a.data.createdAt || 0;
          const timeB = b.data.updatedAt || b.data.createdAt || 0;
          return timeB - timeA;
        });
        
        // Delete duplicates (all except the first/newest)
        for (let i = 1; i < products.length; i++) {
          batch.delete(doc(db, 'takealot_products', products[i].id));
          removedCount++;
        }
      }
    });
    
    if (removedCount > 0) {
      await batch.commit();
    }
    
    await logActivity(
      integrationId, 
      'cleanup_duplicate_products', 
      `Removed ${removedCount} duplicate products by TSIN`,
      'success'
    );
    
    return {
      removed: removedCount,
      success: true,
      message: `Successfully removed ${removedCount} duplicate products`
    };
  } catch (error: any) {
    await logActivity(
      integrationId, 
      'cleanup_duplicate_products', 
      `Error: ${error.message}`,
      'error'
    );
    
    throw new Error(`Failed to cleanup duplicate products: ${error.message}`);
  }
}

// Cleanup duplicate sales by Order ID
export async function cleanupDuplicateSales(integrationId: string): Promise<CleanupResult> {
  try {
    const salesRef = collection(db, 'takealot_sales');
    const q = query(salesRef, where('integrationId', '==', integrationId));
    const snapshot = await getDocs(q);
    
    const orderGroups: { [orderId: string]: any[] } = {};
    
    // Group sales by order_id
    snapshot.docs.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const orderId = data.order_id;
      if (orderId) {
        if (!orderGroups[orderId]) {
          orderGroups[orderId] = [];
        }
        orderGroups[orderId].push({ id: docSnapshot.id, data });
      }
    });
    
    let removedCount = 0;
    const batch = writeBatch(db);
    
    // For each order group, keep the most recent and delete duplicates
    Object.values(orderGroups).forEach(sales => {
      if (sales.length > 1) {
        // Sort by createdAt/updatedAt and keep the newest
        sales.sort((a, b) => {
          const timeA = a.data.updatedAt || a.data.createdAt || 0;
          const timeB = b.data.updatedAt || b.data.createdAt || 0;
          return timeB - timeA;
        });
        
        // Delete duplicates (all except the first/newest)
        for (let i = 1; i < sales.length; i++) {
          batch.delete(doc(db, 'takealot_sales', sales[i].id));
          removedCount++;
        }
      }
    });
    
    if (removedCount > 0) {
      await batch.commit();
    }
    
    await logActivity(
      integrationId, 
      'cleanup_duplicate_sales', 
      `Removed ${removedCount} duplicate sales by Order ID`,
      'success'
    );
    
    return {
      removed: removedCount,
      success: true,
      message: `Successfully removed ${removedCount} duplicate sales`
    };
  } catch (error: any) {
    await logActivity(
      integrationId, 
      'cleanup_duplicate_sales', 
      `Error: ${error.message}`,
      'error'
    );
    
    throw new Error(`Failed to cleanup duplicate sales: ${error.message}`);
  }
}

// Clear all sales for integration
export async function clearAllSales(integrationId: string): Promise<CleanupResult> {
  try {
    const salesRef = collection(db, 'takealot_sales');
    const q = query(salesRef, where('integrationId', '==', integrationId));
    
    let deletedCount = 0;
    
    // Delete in batches to avoid timeout
    while (true) {
      const snapshot = await getDocs(query(salesRef, where('integrationId', '==', integrationId), limit(500)));
      
      if (snapshot.empty) {
        break;
      }
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(docSnapshot => {
        batch.delete(docSnapshot.ref);
        deletedCount++;
      });
      
      await batch.commit();
    }
    
    await logActivity(
      integrationId, 
      'clear_all_sales', 
      `Deleted ${deletedCount} sales records`,
      'success'
    );
    
    return {
      deleted: deletedCount,
      success: true,
      message: `Successfully deleted ${deletedCount} sales records`
    };
  } catch (error: any) {
    await logActivity(
      integrationId, 
      'clear_all_sales', 
      `Error: ${error.message}`,
      'error'
    );
    
    throw new Error(`Failed to clear all sales: ${error.message}`);
  }
}

// Clear all products for integration
export async function clearAllProducts(integrationId: string): Promise<CleanupResult> {
  try {
    const productsRef = collection(db, 'takealot_products');
    const q = query(productsRef, where('integrationId', '==', integrationId));
    
    let deletedCount = 0;
    
    // Delete in batches to avoid timeout
    while (true) {
      const snapshot = await getDocs(query(productsRef, where('integrationId', '==', integrationId), limit(500)));
      
      if (snapshot.empty) {
        break;
      }
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(docSnapshot => {
        batch.delete(docSnapshot.ref);
        deletedCount++;
      });
      
      await batch.commit();
    }
    
    await logActivity(
      integrationId, 
      'clear_all_products', 
      `Deleted ${deletedCount} products`,
      'success'
    );
    
    return {
      deleted: deletedCount,
      success: true,
      message: `Successfully deleted ${deletedCount} products`
    };
  } catch (error: any) {
    await logActivity(
      integrationId, 
      'clear_all_products', 
      `Error: ${error.message}`,
      'error'
    );
    
    throw new Error(`Failed to clear all products: ${error.message}`);
  }
}
