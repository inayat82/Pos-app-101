"use client";
import React, { useContext, useState } from "react";
import { AuthContext } from "@/context/AuthContext";

export default function GlobalErrorAlert() {
  const context = useContext(AuthContext);
  const [dismissed, setDismissed] = useState(false);
  if (!context || !context.error || dismissed) return null;
  return (
    <div className="fixed top-0 left-0 w-full z-50 flex justify-center">
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4 max-w-xl w-full flex items-center shadow">
        <span className="flex-1 text-sm">{context.error}</span>
        <button
          className="ml-4 text-red-700 hover:text-red-900 font-bold text-lg"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss error"
        >
          ×
        </button>
      </div>
    </div>
  );
}
