'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function BrandsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [token, setToken] = useState(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [currentBrand, setCurrentBrand] = useState(null);

  // Form State
  const [formData, setFormData] = useState({ brand_code: '', name: '', description: '' });

  // 1. Security Check
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) router.push('/login');
    else setToken(storedToken);
  }, [router]);

  // 2. Fetch Brands (GET)
  const { data: brands, isLoading, error } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const response = await axios.get('http://localhost:5000/api/brands', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data;
    },
    enabled: !!token,
  });

  // 3. Create Brand (POST)
  const createMutation = useMutation({
    mutationFn: async (newBrand) => {
      const res = await axios.post('http://localhost:5000/api/brands', newBrand, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      closeModal();
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to add brand!')
  });

  // 4. Update Brand (PUT)
  const updateMutation = useMutation({
    mutationFn: async ({ id, updatedData }) => {
      const res = await axios.put(`http://localhost:5000/api/brands/${id}`, updatedData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      closeModal();
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to update brand!')
  });

  // 5. Delete Brand (DELETE)
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axios.delete(`http://localhost:5000/api/brands/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete brand!')
  });

  // Helper Functions
  const openAddModal = () => {
    setModalMode('add');
    setFormData({ brand_code: '', name: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (brand) => {
    setModalMode('edit');
    setCurrentBrand(brand);
    setFormData({ 
      brand_code: brand.brand_code, 
      name: brand.name, 
      description: brand.description || '' 
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentBrand(null);
    setFormData({ brand_code: '', name: '', description: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modalMode === 'add') {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: currentBrand._id, updatedData: formData });
    }
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Kya aap waqai "${name}" ko delete karna chahte hain?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (!token || isLoading) {
    return <p className="text-center mt-10 text-gray-600 font-semibold animate-pulse">Loading brands...</p>;
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 relative">
      
      {/* Header with Add Button */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            All Brands
          </h2>
          <p className="text-gray-500 text-sm mt-1">Manage your inventory brands easily</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
        >
          <span className="text-xl">+</span> Add New Brand
        </button>
      </div>
      
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center font-semibold">
          ⚠️ Error fetching brands! Please check backend.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {brands && brands.map((brand) => (
            <div key={brand._id} className="group relative bg-white border border-gray-200 p-5 rounded-2xl shadow-sm hover:shadow-lg hover:border-blue-300 transition-all duration-300">
              
              {/* Card Content */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-xl text-gray-800">{brand.name}</h3>
                  <p className="text-blue-600 text-xs font-bold bg-blue-50 inline-block px-3 py-1 rounded-full mt-2 border border-blue-100">
                    Code: {brand.brand_code}
                  </p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(brand)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition font-bold"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleDelete(brand._id, brand.name)}
                    disabled={deleteMutation.isPending}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition font-bold"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              {brand.description && (
                <p className="text-gray-600 text-sm mt-3 line-clamp-2 border-t border-gray-100 pt-3">
                  {brand.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL (Add/Edit Form) - SOLID BACKGROUND, NO BLUR --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200 transform transition-all">
            
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {modalMode === 'add' ? '✨ Add New Brand' : '✏️ Edit Brand'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-red-500 text-3xl font-bold leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Brand Code</label>
                <input
                  type="text"
                  value={formData.brand_code}
                  onChange={(e) => setFormData({...formData, brand_code: e.target.value})}
                  className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium placeholder-gray-400"
                  placeholder="e.g., BR001"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Brand Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium placeholder-gray-400"
                  placeholder="e.g., Nike, Apple"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium placeholder-gray-400 resize-none"
                  rows="3"
                  placeholder="Optional details about the brand..."
                />
              </div>

              <div className="flex gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (modalMode === 'add' ? 'Add Brand' : 'Update Brand')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}