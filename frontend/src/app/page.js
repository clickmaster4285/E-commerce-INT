'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Seedha login par bhej do. 
    // Agar user ke paas valid cookie hogi, toh middleware.js usay 
    // automatically /admin/dashboard par redirect kar dega!
    router.push('/login');
  }, [router]);

  return null; // Kuch render karne ki zaroorat nahi
}