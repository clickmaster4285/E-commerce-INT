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
  const [modalMode, setModalMode] = useState('add');
  const [currentBrand, setCurrentBrand] = useState(null);

  // Form State
  const [formData, setFormData] = useState({ brand_code: '', name: '', description: '' });

  // Security Check
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) router.push('/login');
    else setToken(storedToken);
  }, [router]);

  // Fetch Brands
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

  // Create Brand
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

  // Update Brand
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

  // Delete Brand
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
    return <p className="text-center mt-10 font-semibold animate-pulse" style={{ color: 'var(--text-muted)' }}>Loading brands...</p>;
  }

  return (
    <div className="rounded-3xl shadow-xl relative" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '32px' }}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-extrabold" style={{ color: 'var(--accent)' }}>
            All Brands
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage your inventory brands easily</p>
        </div>
        <button 
          onClick={openAddModal}
          className="btn-primary flex items-center gap-2"
        >
          <span className="text-xl">+</span> Add New Brand
        </button>
      </div>
      
      {error ? (
        <div className="text-center font-semibold rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
          ⚠️ Error fetching brands! Please check backend.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {brands && brands.map((brand) => (
            <div key={brand._id} className="card group relative transition-all duration-300 hover:shadow-lg" style={{ padding: '20px' }}>
              
              {/* Card Content */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>{brand.name}</h3>
                  <p className="text-xs font-bold inline-block px-3 py-1 rounded-full mt-2" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--accent)', border: '1px solid var(--border-color)' }}>
                    Code: {brand.brand_code}
                  </p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(brand)}
                    className="p-2 rounded-lg transition font-bold"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--accent)' }}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleDelete(brand._id, brand.name)}
                    disabled={deleteMutation.isPending}
                    className="p-2 rounded-lg transition font-bold"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--danger)' }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              {brand.description && (
                <p className="text-sm mt-3 line-clamp-2" style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  {brand.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="card rounded-2xl shadow-2xl w-full max-w-md" style={{ padding: '24px' }}>
            
            <div className="flex justify-between items-center mb-6 pb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {modalMode === 'add' ? '✨ Add New Brand' : '✏️ Edit Brand'}
              </h3>
              <button onClick={closeModal} className="text-3xl font-bold leading-none hover:opacity-70 transition" style={{ color: 'var(--text-muted)' }}>&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>Brand Code</label>
                <input
                  type="text"
                  value={formData.brand_code}
                  onChange={(e) => setFormData({...formData, brand_code: e.target.value})}
                  className="input-field"
                  placeholder="e.g., BR001"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>Brand Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="input-field"
                  placeholder="e.g., Nike, Apple"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="input-field resize-none"
                  rows="3"
                  placeholder="Optional details about the brand..."
                />
              </div>

              <div className="flex gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-xl font-bold transition"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary flex-1 py-3 rounded-xl font-bold"
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