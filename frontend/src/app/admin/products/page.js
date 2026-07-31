'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function ProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [token, setToken] = useState(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [currentProduct, setCurrentProduct] = useState(null);

  // Form State (Product specific fields)
  const [formData, setFormData] = useState({
    product_code: '',
    sku: '',
    name: '',
    description: '',
    category_id: '',
    brand_id: '',
    purchase_price: '',
    selling_price: ''
  });

  // 1. Security Check
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) router.push('/login');
    else setToken(storedToken);
  }, [router]);

  // 2. Fetch Products (GET)
  const { data: products, isLoading: productsLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await axios.get('http://localhost:5000/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data;
    },
    enabled: !!token,
  });

  // 3. Fetch Brands & Categories for Dropdowns
  const { data: brandsList } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/brands', { headers: { 'Authorization': `Bearer ${token}` } });
      return res.data;
    },
    enabled: !!token,
  });

  const { data: categoriesList } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/categories', { headers: { 'Authorization': `Bearer ${token}` } });
      return res.data;
    },
    enabled: !!token,
  });

  // 4. Create Product (POST)
  const createMutation = useMutation({
    mutationFn: async (newProduct) => {
      const res = await axios.post('http://localhost:5000/api/products', newProduct, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to add product!')
  });

  // 5. Update Product (PUT)
  const updateMutation = useMutation({
    mutationFn: async ({ id, updatedData }) => {
      const res = await axios.put(`http://localhost:5000/api/products/${id}`, updatedData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to update product!')
  });

  // 6. Delete Product (DELETE)
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axios.delete(`http://localhost:5000/api/products/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete product!')
  });

  // Helper Functions
  const openAddModal = () => {
    setModalMode('add');
    setFormData({ product_code: '', sku: '', name: '', description: '', category_id: '', brand_id: '', purchase_price: '', selling_price: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setModalMode('edit');
    setCurrentProduct(product);
    setFormData({
      product_code: product.product_code,
      sku: product.sku || '',
      name: product.name,
      description: product.description || '',
      category_id: product.category_id?._id || product.category_id || '',
      brand_id: product.brand_id?._id || product.brand_id || '',
      purchase_price: product.purchase_price || '',
      selling_price: product.selling_price || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentProduct(null);
    setFormData({ product_code: '', sku: '', name: '', description: '', category_id: '', brand_id: '', purchase_price: '', selling_price: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modalMode === 'add') {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: currentProduct._id, updatedData: formData });
    }
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Kya aap waqai "${name}" ko delete karna chahte hain?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (!token || productsLoading) {
    return <p className="text-center mt-10 text-gray-600 font-semibold animate-pulse">Loading products...</p>;
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 relative">
      
      {/* Header with Add Button */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
            All Products
          </h2>
          <p className="text-gray-500 text-sm mt-1">Manage your inventory, pricing, and details</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
        >
          <span className="text-xl">+</span> Add New Product
        </button>
      </div>
      
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center font-semibold">
          ⚠️ Error fetching products! Please check backend.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products && products.map((product) => (
            <div key={product._id} className="group relative bg-white border border-gray-200 p-5 rounded-2xl shadow-sm hover:shadow-lg hover:border-purple-300 transition-all duration-300">
              
              {/* Card Content */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-xl text-gray-800">{product.name}</h3>
                  <p className="text-purple-600 text-xs font-bold bg-purple-50 inline-block px-3 py-1 rounded-full mt-2 border border-purple-100">
                    Code: {product.product_code}
                  </p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(product)}
                    className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-600 hover:text-white transition font-bold"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleDelete(product._id, product.name)}
                    disabled={deleteMutation.isPending}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition font-bold"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              {/* Product Details */}
              <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                <p className="text-gray-600 text-sm flex items-center gap-2">
                  <span>🏢</span> Brand: <span className="font-semibold text-gray-800">{product.brand_id?.name || 'N/A'}</span>
                </p>
                <p className="text-gray-600 text-sm flex items-center gap-2">
                  <span>📂</span> Category: <span className="font-semibold text-gray-800">{product.category_id?.name || 'N/A'}</span>
                </p>
                <p className="text-gray-800 font-extrabold text-lg mt-2 flex items-center gap-2">
                  <span>💰</span> Rs. {product.selling_price}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL (Add/Edit Form) - SOLID BACKGROUND, NO BLUR --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-gray-200 transform transition-all my-8">
            
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {modalMode === 'add' ? '✨ Add New Product' : '✏️ Edit Product'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-red-500 text-3xl font-bold leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Product Code</label>
                  <input type="text" value={formData.product_code} onChange={(e) => setFormData({...formData, product_code: e.target.value})} className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">SKU</label>
                  <input type="text" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Product Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Brand</label>
                  <select value={formData.brand_id} onChange={(e) => setFormData({...formData, brand_id: e.target.value})} className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" required>
                    <option value="">Select Brand</option>
                    {brandsList && brandsList.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Category</label>
                  <select value={formData.category_id} onChange={(e) => setFormData({...formData, category_id: e.target.value})} className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" required>
                    <option value="">Select Category</option>
                    {categoriesList && categoriesList.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Purchase Price (Rs.)</label>
                  <input type="number" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Selling Price (Rs.)</label>
                  <input type="number" value={formData.selling_price} onChange={(e) => setFormData({...formData, selling_price: e.target.value})} className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none" rows="2" />
              </div>

              <div className="flex gap-3 mt-6 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-3 border border-gray-300 text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 font-bold transition">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition disabled:opacity-70">
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (modalMode === 'add' ? 'Add Product' : 'Update Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}