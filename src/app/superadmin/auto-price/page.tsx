// Superadmin Auto Price Management Page
import { Metadata } from 'next';
import AutoPriceSystemMonitor from '@/modules/auto-price/components/superadmin/AutoPriceSystemMonitor';

export const metadata: Metadata = {
  title: 'Auto Price System | Superadmin',
  description: 'Monitor and manage the Auto Price scraping system'
};

export default function SuperadminAutoPricePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Auto Price System Management
              </h1>
              <p className="text-gray-600 mt-1">
                Monitor scraping performance, proxy health, and system status
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Superadmin Access
            </div>
          </div>
        </div>
      </div>
      
      <AutoPriceSystemMonitor />
    </div>
  );
}
