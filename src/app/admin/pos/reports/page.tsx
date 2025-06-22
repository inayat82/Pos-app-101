'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiDollarSign, 
  FiPackage, 
  FiShoppingCart, 
  FiUsers, 
  FiCalendar,
  FiDownload,
  FiPieChart,  FiBarChart,
  FiActivity
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';

// Types
interface Product {
  id: string;
  name: string;
  sku: string;
  stockQty: number;
  purchasePrice: number;
  sellPrice: number;
  reorderLevel?: number;
  brandName?: string;
  categoryName?: string;
}

interface Sale {
  id: string;
  total: number;
  subtotal: number;
  totalItems: number;
  createdAt: Timestamp;
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

interface StockAdjustment {
  id: string;
  adjustmentType: 'increase' | 'decrease';
  quantity: number;
  createdAt: Timestamp;
}

interface DashboardStats {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalAdjustments: number;
  averageOrderValue: number;
  topSellingProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

const ReportsPage = () => {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Set page title
  useEffect(() => {
    setPageTitle('Reports & Analytics');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalSales: 0,
    totalRevenue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    totalAdjustments: 0,
    averageOrderValue: 0,
    topSellingProducts: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDateRange, setSelectedDateRange] = useState('7days');

  // Fetch data
  useEffect(() => {
    if (!currentUser) return;    const fetchProducts = () => {
      const productsRef = collection(db, `admins/${currentUser.uid}/pos_products`);
      const productsQuery = query(productsRef, orderBy('name'));
      
      return onSnapshot(productsQuery, (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        setProducts(productsData);
      });
    };

    const fetchSales = () => {
      const salesRef = collection(db, `admins/${currentUser.uid}/sales`);
      const salesQuery = query(salesRef, orderBy('createdAt', 'desc'));
      
      return onSnapshot(salesQuery, (snapshot) => {
        const salesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Sale[];
        setSales(salesData);
      });
    };

    const fetchAdjustments = () => {
      const adjustmentsRef = collection(db, `admins/${currentUser.uid}/stock_adjustments`);
      const adjustmentsQuery = query(adjustmentsRef, orderBy('createdAt', 'desc'));
      
      return onSnapshot(adjustmentsQuery, (snapshot) => {
        const adjustmentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockAdjustment[];
        setAdjustments(adjustmentsData);
        setIsLoading(false);
      });
    };

    const unsubscribeProducts = fetchProducts();
    const unsubscribeSales = fetchSales();
    const unsubscribeAdjustments = fetchAdjustments();

    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeSales) unsubscribeSales();
      if (unsubscribeAdjustments) unsubscribeAdjustments();
    };
  }, [currentUser]);

  // Calculate statistics
  useEffect(() => {
    const calculateStats = () => {
      // Basic counts
      const totalProducts = products.length;
      const totalSales = sales.length;
      const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
      const lowStockItems = products.filter(p => p.reorderLevel && p.stockQty <= p.reorderLevel && p.stockQty > 0).length;
      const outOfStockItems = products.filter(p => p.stockQty === 0).length;
      const totalAdjustments = adjustments.length;
      const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Top selling products
      const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
      
      sales.forEach(sale => {
        sale.products?.forEach(product => {
          if (!productSales[product.productId]) {
            productSales[product.productId] = {
              name: product.productName,
              quantity: 0,
              revenue: 0
            };
          }
          productSales[product.productId].quantity += product.quantity;
          productSales[product.productId].revenue += product.totalPrice;
        });
      });

      const topSellingProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      setStats({
        totalProducts,
        totalSales,
        totalRevenue,
        lowStockItems,
        outOfStockItems,
        totalAdjustments,
        averageOrderValue,
        topSellingProducts
      });
    };

    calculateStats();
  }, [products, sales, adjustments]);

  // Chart data preparation
  const getSalesChartData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', { weekday: 'short' })
      };
    }).reverse();

    return last7Days.map(day => {
      const daySales = sales.filter(sale => {
        const saleDate = sale.createdAt?.toDate().toISOString().split('T')[0];
        return saleDate === day.date;
      });
      
      return {
        name: day.label,
        sales: daySales.length,
        revenue: daySales.reduce((sum, sale) => sum + sale.total, 0)
      };
    });
  };

  const getStockDistributionData = () => {
    const inStock = products.filter(p => p.stockQty > (p.reorderLevel || 0)).length;
    const lowStock = products.filter(p => p.reorderLevel && p.stockQty <= p.reorderLevel && p.stockQty > 0).length;
    const outOfStock = products.filter(p => p.stockQty === 0).length;

    return [
      { name: 'In Stock', value: inStock, color: '#10b981' },
      { name: 'Low Stock', value: lowStock, color: '#f59e0b' },
      { name: 'Out of Stock', value: outOfStock, color: '#ef4444' }
    ];
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const salesChartData = getSalesChartData();
  const stockDistributionData = getStockDistributionData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Business insights and performance metrics</p>
        </div>
        <div className="flex space-x-3">
          <select
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            <FiDownload className="h-4 w-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiDollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                R{stats.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <FiShoppingCart className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSales}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FiPackage className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FiTrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg. Order Value</p>
              <p className="text-2xl font-bold text-gray-900">
                R{stats.averageOrderValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Sales Trend</h3>
            <FiBarChart className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />                <Tooltip 
                  formatter={(value: any, name: any) => [
                    name === 'revenue' ? `R${Number(value).toLocaleString()}` : value,
                    name === 'revenue' ? 'Revenue' : 'Sales'
                  ]}
                />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                <Area type="monotone" dataKey="sales" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stock Distribution Chart */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Stock Distribution</h3>
            <FiPieChart className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockDistributionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }: any) => `${name}: ${value}`}
                >
                  {stockDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Top Selling Products</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty Sold
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.topSellingProducts.map((product, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      R{product.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Inventory Alerts</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <FiPackage className="h-4 w-4 text-red-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">Out of Stock</p>
                  <p className="text-xs text-red-600">Items with zero inventory</p>
                </div>
              </div>
              <span className="text-lg font-bold text-red-900">{stats.outOfStockItems}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <FiTrendingDown className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-800">Low Stock</p>
                  <p className="text-xs text-yellow-600">Items below reorder level</p>
                </div>
              </div>
              <span className="text-lg font-bold text-yellow-900">{stats.lowStockItems}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FiActivity className="h-4 w-4 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-800">Stock Adjustments</p>
                  <p className="text-xs text-blue-600">Recent inventory changes</p>
                </div>
              </div>
              <span className="text-lg font-bold text-blue-900">{stats.totalAdjustments}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
