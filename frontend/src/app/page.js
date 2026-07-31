'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 1. Check karein ke kya user login hai?
    const token = localStorage.getItem('token');

    if (token) {
      // Agar token hai, toh Dashboard par bhej do
      router.push('/dashboard');
    } else {
      // Agar token nahi hai, toh Login page par bhej do
      router.push('/login');
    }
  }, [router]);

  // Jab tak redirect ho raha hai, ye chota sa message dikhega
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <p className="text-xl text-gray-600">Redirecting...</p>
    </div>
  );
}