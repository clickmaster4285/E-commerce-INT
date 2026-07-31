'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState(null);

  // 1. Security Check: Kya user login hai?
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
    } else {
      setToken(storedToken);
    }
  }, [router]);

  // Jab tak token na aaye, loading dikhao
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  // 2. UI Design (Welcome Message + Modern Gradient Cards)
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
          Welcome to Dashboard! 👋
        </h1>
        <p className="text-gray-500 mt-2 text-sm">Select a module below to get started.</p>
      </div>

      {/* Shortcut Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Brands Card */}
        <div 
          onClick={() => router.push('/dashboard/brands')}
          className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1 group"
        >
          {/* Decorative background circle */}
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-300"></div>
          
          <div className="relative z-10">
            <div className="text-4xl mb-3 drop-shadow-md">🏷️</div>
            <h2 className="text-2xl font-bold">Brands</h2>
            <p className="mt-2 text-blue-100 text-sm">View and manage all your brands.</p>
          </div>
        </div>

        {/* Categories Card */}
        <div 
          onClick={() => router.push('/dashboard/categories')}
          className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-green-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1 group"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-300"></div>
          
          <div className="relative z-10">
            <div className="text-4xl mb-3 drop-shadow-md">📂</div>
            <h2 className="text-2xl font-bold">Categories</h2>
            <p className="mt-2 text-green-100 text-sm">Organize your products by category.</p>
          </div>
        </div>

        {/* Products Card */}
        <div 
          onClick={() => router.push('/dashboard/products')}
          className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1 group"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-300"></div>
          
          <div className="relative z-10">
            <div className="text-4xl mb-3 drop-shadow-md">📦</div>
            <h2 className="text-2xl font-bold">Products</h2>
            <p className="mt-2 text-purple-100 text-sm">Check your inventory and prices.</p>
          </div>
        </div>

      </div>
    </div>
  );
}