import React from 'react';
import { FiPackage, FiDollarSign, FiUsers, FiStar, FiTrendingUp, FiShield } from 'react-icons/fi';

interface SampleDataDisplayProps {
  show: boolean;
  onClose: () => void;
}

export const SampleDataDisplay: React.FC<SampleDataDisplayProps> = ({ show, onClose }) => {
  const sampleData = {
    requestSeller: "anv",
    title: "2 Piece Solar Bird Bath Fountain Pump for Garden, Ponds, Pool, Fish Tank",
    brand: "",
    barcode: "MPTALX22817334-0",
    winnerSeller: "Hokame",
    winnerPrice: 280,
    winnerStock: "In stock",
    winDifference: 70,
    winPrice: 279,
    totalSellers: 2,
    reviewCount: 1,
    rating: 5,
    plid: "PLID97283209",
    productUrl: "https://www.takealot.com/2-piece-solar-bird-bath-fountain-pump-for-garden-ponds-pool-fish/PLID97283209",
    imageUrl: "https://media.takealot.com/covers_images/9d03725e1afd4f8dbeb91babc3e74b6b/s-zoom.file",
    sellers: [
      { name: "Hokame", price: 280, stock: "In stock", isWinner: true, rank: 1 },
      { name: "ANV", price: 350, stock: "In stock", isWinner: false, rank: 2 }
    ]
  };

  if (!show) return null;

  const formatCurrency = (amount: number) => `R${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const getRatingStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FiStar
          key={i}
          className={`h-4 w-4 ${i <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
        />
      );
    }
    return stars;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <img
                src={sampleData.imageUrl}
                alt={sampleData.title}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div>
                <h2 className="text-xl font-bold text-gray-900">{sampleData.title}</h2>
                <p className="text-gray-600">PLID: {sampleData.plid}</p>
                <p className="text-gray-600">Barcode: {sampleData.barcode}</p>
                <div className="flex items-center mt-2">
                  <FiPackage className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-600">Sample Data Available</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => window.open(sampleData.productUrl, '_blank')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View on Takealot
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Intelligence (Sample Data)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FiDollarSign className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-600">Winner Price</p>
                  <p className="text-2xl font-bold text-green-800">{formatCurrency(sampleData.winnerPrice)}</p>
                  <p className="text-xs text-green-600">{sampleData.winnerSeller}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FiUsers className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Sellers</p>
                  <p className="text-2xl font-bold text-blue-800">{sampleData.totalSellers}</p>
                  <p className="text-xs text-blue-600">Active competitors</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FiStar className="h-8 w-8 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-600">Rating</p>
                  <div className="flex items-center">
                    <p className="text-2xl font-bold text-yellow-800 mr-2">{sampleData.rating.toFixed(1)}</p>
                    <div className="flex">
                      {getRatingStars(sampleData.rating)}
                    </div>
                  </div>
                  <p className="text-xs text-yellow-600">{sampleData.reviewCount} reviews</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FiTrendingUp className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-purple-600">Price Difference</p>
                  <p className="text-2xl font-bold text-purple-800">
                    +{formatCurrency(sampleData.winDifference)}
                  </p>
                  <p className="text-xs text-purple-600">Above winner price</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sample Sellers Table */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitive Analysis (Sample)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Winner</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sampleData.sellers.map((seller, index) => (
                  <tr key={index} className={seller.isWinner ? 'bg-green-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{seller.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{seller.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{formatCurrency(seller.price)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                        {seller.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {seller.isWinner && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                          <FiStar className="h-3 w-3 mr-1" />
                          Winner
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Data Structure Information */}
        <div className="p-6 bg-blue-50">
          <h4 className="text-lg font-semibold text-blue-900 mb-4">Available Data Fields</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium text-blue-800 mb-2">Product Information</h5>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Product Title & Brand</li>
                <li>• PLID & Barcode</li>
                <li>• Product URL & Image</li>
                <li>• Stock Status</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-blue-800 mb-2">Market Data</h5>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Winner Price & Seller</li>
                <li>• Total Sellers Count</li>
                <li>• Competitive Pricing</li>
                <li>• Rating & Reviews</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-blue-800 mb-2">Business Intelligence</h5>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Price Difference Analysis</li>
                <li>• Market Position</li>
                <li>• Competitive Advantage</li>
                <li>• Win Price Calculation</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-blue-800 mb-2">Technical Data</h5>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Scraping Timestamps</li>
                <li>• Proxy Information</li>
                <li>• Performance Metrics</li>
                <li>• Error Handling</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
