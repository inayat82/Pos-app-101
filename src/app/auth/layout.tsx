import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <main className="w-full max-w-md">
        {children}
      </main>
      <footer className="mt-8 text-center text-sm text-gray-400">
        © 2025 Inventory Hub. All rights reserved.
      </footer>
    </div>
  );
}
