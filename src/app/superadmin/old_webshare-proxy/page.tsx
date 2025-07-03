'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WebshareProxyPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new webshare page
    router.push('/superadmin/webshare');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Redirecting...</h2>
        <p className="text-gray-600">Taking you to the updated WebShare management page.</p>
      </div>
    </div>
  );
}
