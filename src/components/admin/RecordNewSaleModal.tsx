
import React, { useState } from 'react';
import { FiX, FiDollarSign, FiShoppingCart, FiSearch, FiTrash2, FiCheckCircle } from 'react-icons/fi';

interface RecordNewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteSale: (saleData: any) => void; // Replace 'any' with a proper type later
}

// Dummy product type - replace with actual type
interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

const RecordNewSaleModal: React.FC<RecordNewSaleModalProps> = ({ isOpen, onClose, onCompleteSale }) => {
  if (!isOpen) return null;

  const [customer, setCustomer] = useState('Walk-in Customer');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [addedProducts, setAddedProducts] = useState<Product[]>([]);
  const [notes, setNotes] = useState('');

  // Dummy product search results - replace with actual search logic
  const dummyProducts: Product[] = [
    { id: 'prod1', name: 'Sample Product A', price: 10.00, quantity: 1 },
    { id: 'prod2', name: 'Sample Product B', price: 25.50, quantity: 1 },
    { id: 'prod3', name: 'Another Item C', price: 5.75, quantity: 1 },
  ];

  const handleAddProduct = (product: Product) => {
    // Basic add, doesn't handle existing product increment yet
    setAddedProducts(prev => [...prev, { ...product, quantity: 1 }]);
    setSearchTerm(''); // Clear search term after adding
  };

  const handleRemoveProduct = (productId: string) => {
    setAddedProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return; // Prevent quantity less than 1
    setAddedProducts(prev => 
      prev.map(p => p.id === productId ? { ...p, quantity: newQuantity } : p)
    );
  };

  const totalItems = addedProducts.reduce((sum, p) => sum + p.quantity, 0);
  const totalPrice = addedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Actual sale completion logic will be implemented later
    onCompleteSale({ 
      customer,
      paymentMethod,
      products: addedProducts,
      totalItems,
      totalPrice,
      notes 
    });
    onClose(); // Close modal after submitting
  };

  const filteredProducts = searchTerm 
    ? dummyProducts.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-lg">
          <div className="flex items-center">
            <FiDollarSign className="text-2xl text-green-600 mr-3" />
            <h3 className="text-xl font-semibold text-gray-800">Record New Sale</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="customer" className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select 
                  id="customer" 
                  value={customer} 
                  onChange={(e) => setCustomer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option>Walk-in Customer</option>
                  {/* Add other customer options here */}
                </select>
              </div>
              <div>
                <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select 
                  id="paymentMethod" 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Online Transfer</option>
                  {/* Add other payment methods */}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="addProduct" className="block text-sm font-medium text-gray-700 mb-1">Add Product</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  id="addProduct" 
                  placeholder="Search by name or barcode..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              {searchTerm && filteredProducts.length > 0 && (
                <ul className="border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto bg-white shadow-lg">
                  {filteredProducts.map(p => (
                    <li 
                      key={p.id} 
                      onClick={() => handleAddProduct(p)} 
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {p.name} - R{p.price.toFixed(2)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {addedProducts.length > 0 && (
              <div className="border border-gray-200 rounded-md p-4 space-y-3 bg-gray-50">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Order Items:</h4>
                {addedProducts.map(product => (
                  <div key={product.id} className="flex justify-between items-center p-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-500">Price: R{product.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        value={product.quantity} 
                        onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value))}
                        className="w-16 text-center border border-gray-300 rounded-md py-1 px-2 mx-2 sm:text-sm"
                        min="1"
                      />
                      <p className="font-medium text-gray-800 w-20 text-right">R{(product.price * product.quantity).toFixed(2)}</p>
                      <button type="button" onClick={() => handleRemoveProduct(product.id)} className="ml-3 text-red-500 hover:text-red-700">
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-right mt-4">
              <p className="text-sm text-gray-600">Items: <span className="font-semibold">{totalItems}</span></p>
              <p className="text-xl font-bold text-gray-800">Total: R {totalPrice.toFixed(2)}</p>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea 
                id="notes" 
                rows={3} 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or notes for this sale..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end items-center p-5 border-t bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center"
            >
              <FiCheckCircle className="mr-2" /> Complete Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordNewSaleModal;
