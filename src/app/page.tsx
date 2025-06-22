'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/login');
  }, [router]);

  // Optional: You can show a loading state or a blank page while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <p className="text-white">Loading...</p>
    </div>
  );
}
