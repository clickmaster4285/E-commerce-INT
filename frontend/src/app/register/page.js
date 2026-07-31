'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const registerMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await axios.post('http://localhost:5000/api/users/register', userData);
      return response.data;
    },
    onSuccess: (data) => {
      alert('Account successfully created! Please login.');
      router.push('/login');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Registration failed!');
    }
  });

  const handleRegister = (e) => {
    e.preventDefault();
    registerMutation.mutate(formData);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 p-4">
      
      {/* Compact Card - Smaller padding */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-white/20">
        
        {/* Smaller Heading */}
        <div className="text-center mb-4">
          <div className="text-3xl mb-1">🚀</div>
          <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            Create Account
          </h2>
          <p className="text-gray-500 mt-1 text-xs">Join us and manage your inventory</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-3">
          {/* Name Input */}
          <div>
            <label className="block text-gray-700 text-xs font-semibold mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-gray-50 text-gray-900 p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400 text-sm"
              placeholder="John Doe"
              required
            />
          </div>

          {/* Username Input */}
          <div>
            <label className="block text-gray-700 text-xs font-semibold mb-1">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full bg-gray-50 text-gray-900 p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400 text-sm"
              placeholder="johndoe123"
              required
            />
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-gray-700 text-xs font-semibold mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-gray-50 text-gray-900 p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400 text-sm"
              placeholder="you@example.com"
              required
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-gray-700 text-xs font-semibold mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-gray-50 text-gray-900 p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400 text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Smaller Button */}
          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold p-2.5 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 mt-2 text-sm"
          >
            {registerMutation.isPending ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        {/* Smaller Login Link */}
        <p className="text-center mt-4 text-gray-600 text-xs">
          Already have an account?{' '}
          <a href="/login" className="text-indigo-600 font-semibold hover:text-indigo-800 hover:underline transition-colors">
            Login here
          </a>
        </p>
      </div>
    </div>
  );
}