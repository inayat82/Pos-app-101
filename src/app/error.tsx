"use client";

import React from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-red-600">Something went wrong</h2>
        <p className="mb-4 text-gray-700">{error.message || "An unexpected error occurred. Please try again."}</p>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
