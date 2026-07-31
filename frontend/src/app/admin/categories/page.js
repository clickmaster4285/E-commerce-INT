'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function CategoriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [token, setToken] = useState(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [currentCategory, setCurrentCategory] = useState(null);

  // Form State
  const [formData, setFormData] = useState({ category_code: '', name: '', description: '' });

  // 1. Security Check
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) router.push('/login');
    else setToken(storedToken);
  }, [router]);

  // 2. Fetch Categories (GET)
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await axios.get('http://localhost:5000/api/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data;
    },
    enabled: !!token,
  });

  // 3. Create Category (POST)
  const createMutation = useMutation({
    mutationFn: async (newCategory) => {
      const res = await axios.post('http://localhost:5000/api/categories', newCategory, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to add category!')
  });

  // 4. Update Category (PUT)
  const updateMutation = useMutation({
    mutationFn: async ({ id, updatedData }) => {
      const res = await axios.put(`http://localhost:5000/api/categories/${id}`, updatedData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to update category!')
  });

  // 5. Delete Category (DELETE)
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axios.delete(`http://localhost:5000/api/categories/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete category!')
  });

  // Helper Functions
  const openAddModal = () => {
    setModalMode('add');
    setFormData({ category_code: '', name: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (category) => {
    setModalMode('edit');
    setCurrentCategory(category);
    setFormData({ 
      category_code: category.category_code, 
      name: category.name, 
      description: category.description || '' 
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentCategory(null);
    setFormData({ category_code: '', name: '', description: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modalMode === 'add') {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: currentCategory._id, updatedData: formData });
    }
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Kya aap waqai "${name}" ko delete karna chahte hain?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (!token || isLoading) {
    return <p className="text-center mt-10 text-gray-600 font-semibold animate-pulse">Loading categories...</p>;
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 relative">
      
      {/* Header with Add Button */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-600">
            All Categories
          </h2>
          <p className="text-gray-500 text-sm mt-1">Organize and manage your product categories</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
        >
          <span className="text-xl">+</span> Add New Category
        </button>
      </div>
      
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center font-semibold">
          ⚠️ Error fetching categories! Please check backend.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories && categories.map((category) => (
            <div key={category._id} className="group relative bg-white border border-gray-200 p-5 rounded-2xl shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all duration-300">
              
              {/* Card Content */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-xl text-gray-800">{category.name}</h3>
                  <p className="text-emerald-600 text-xs font-bold bg-emerald-50 inline-block px-3 py-1 rounded-full mt-2 border border-emerald-100">
                    Code: {category.category_code}
                  </p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(category)}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition font-bold"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleDelete(category._id, category.name)}
                    disabled={deleteMutation.isPending}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition font-bold"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              {category.description && (
                <p className="text-gray-600 text-sm mt-3 line-clamp-2 border-t border-gray-100 pt-3">
                  {category.description}
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
                {modalMode === 'add' ? '✨ Add New Category' : '✏️ Edit Category'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-red-500 text-3xl font-bold leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Category Code</label>
                <input
                  type="text"
                  value={formData.category_code}
                  onChange={(e) => setFormData({...formData, category_code: e.target.value})}
                  className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium placeholder-gray-400"
                  placeholder="e.g., CAT001"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Category Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium placeholder-gray-400"
                  placeholder="e.g., Electronics, Clothing"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium placeholder-gray-400 resize-none"
                  rows="3"
                  placeholder="Optional details about the category..."
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
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold hover:shadow-lg transition disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (modalMode === 'add' ? 'Add Category' : 'Update Category')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}   