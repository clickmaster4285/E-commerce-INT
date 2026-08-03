"use client";

import React, { useState, useEffect } from "react";

const API_BASE_URL = "http://localhost:5000/api";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [viewMode, setViewMode] = useState("grid"); // grid or table

  const [formData, setFormData] = useState({
    product_code: "",
    sku: "",
    barcode: "",
    name: "",
    description: "",
    category_id: "",
    brand_id: "",
    purchase_price: "",
    selling_price: "",
    cost_price: "",
    tax_rate: "0",
    stock_quantity: "0",
    minimum_stock: "0",
    image_url: "",
    is_active: true,
    is_featured: false,
  });

  // Data fetch karna
  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, categoriesRes, brandsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/categories`),
        fetch(`${API_BASE_URL}/brands`),
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(Array.isArray(data) ? data : []);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(Array.isArray(data) ? data : []);
      }
      if (brandsRes.ok) {
        const data = await brandsRes.json();
        setBrands(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setMessage({ type: "error", text: "Data fetch karne mein error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingProduct
        ? `${API_BASE_URL}/products/${editingProduct._id}`
        : `${API_BASE_URL}/products`;

      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Operation failed");
      }

      setMessage({
        type: "success",
        text: editingProduct
          ? "Product update ho gaya!"
          : "Product kamiyabi se add ho gaya!",
      });

      resetForm();
      setShowModal(false);
      fetchData();

      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  };

  // Delete product
  const handleDelete = async (id) => {
    if (!confirm("Kya aap waqai is product ko delete karna chahte hain?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Delete failed");
      }

      setMessage({ type: "success", text: "Product delete ho gaya!" });
      fetchData();
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  };

  // Edit product
  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      product_code: product.product_code || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      name: product.name || "",
      description: product.description || "",
      category_id: product.category_id?._id || product.category_id || "",
      brand_id: product.brand_id?._id || product.brand_id || "",
      purchase_price: product.purchase_price || "",
      selling_price: product.selling_price || "",
      cost_price: product.cost_price || "",
      tax_rate: product.tax_rate || "0",
      stock_quantity: product.stock_quantity || "0",
      minimum_stock: product.minimum_stock || "0",
      image_url: product.image_url || "",
      is_active: product.is_active !== undefined ? product.is_active : true,
      is_featured: product.is_featured || false,
    });
    setShowModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      product_code: "",
      sku: "",
      barcode: "",
      name: "",
      description: "",
      category_id: "",
      brand_id: "",
      purchase_price: "",
      selling_price: "",
      cost_price: "",
      tax_rate: "0",
      stock_quantity: "0",
      minimum_stock: "0",
      image_url: "",
      is_active: true,
      is_featured: false,
    });
    setEditingProduct(null);
  };

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.product_code?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      filterCategory === "all" || p.category_id === filterCategory || p.category_id?._id === filterCategory;
    const matchBrand =
      filterBrand === "all" || p.brand_id === filterBrand || p.brand_id?._id === filterBrand;
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && p.is_active) ||
      (filterStatus === "inactive" && !p.is_active);
    return matchSearch && matchCategory && matchBrand && matchStatus;
  });

  // Stats
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.is_active).length;
  const lowStockProducts = products.filter(
    (p) => p.stock_quantity <= p.minimum_stock
  ).length;
  const totalValue = products.reduce(
    (sum, p) => sum + (p.selling_price || 0) * (p.stock_quantity || 0),
    0
  );

  // Discount calculate karna
  const calculateDiscount = (purchase, selling) => {
    if (!purchase || !selling) return 0;
    const discount = ((purchase - selling) / purchase) * 100;
    return Math.round(discount);
  };

  // Helper functions
  const getCategoryName = (categoryId) => {
    const category = categories.find(
      (c) => c._id === categoryId || c._id === categoryId?._id
    );
    return category?.name || "N/A";
  };

  const getBrandName = (brandId) => {
    const brand = brands.find(
      (b) => b._id === brandId || b._id === brandId?._id
    );
    return brand?.name || "N/A";
  };

  const getInitials = (name) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      "bg-emerald-600",
      "bg-blue-600",
      "bg-purple-600",
      "bg-pink-600",
      "bg-amber-600",
      "bg-cyan-600",
      "bg-rose-600",
      "bg-indigo-600",
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Product Management</h1>
          <p className="text-slate-400 mt-1">
            Manage your products, inventory, and pricing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 rounded-lg border border-slate-700 p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-md transition ${
                viewMode === "grid"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-md transition ${
                viewMode === "table"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-900/30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
              : "bg-red-900/40 text-red-300 border border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Products</p>
          <p className="text-2xl font-bold text-white mt-1">{totalProducts}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Active Products</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{activeProducts}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Low Stock</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{lowStockProducts}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Inventory Value</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">Rs.{totalValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-600 transition"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
          >
            <option value="all">All Brands</option>
            {brands.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Products Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              Koi product nahi mila. "Add Product" par click karein.
            </div>
          ) : (
            filteredProducts.map((product) => {
              const discount = calculateDiscount(
                product.purchase_price,
                product.selling_price
              );
              return (
                <div
                  key={product._id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-600/50 transition group"
                >
                  {/* Product Image */}
                  <div className="relative aspect-square bg-slate-950 overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className={`w-full h-full ${getAvatarColor(product.name)} flex items-center justify-center`}>
                        <span className="text-4xl font-bold text-white">
                          {getInitials(product.name)}
                        </span>
                      </div>
                    )}
                    {discount > 0 && (
                      <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                        {discount}% OFF
                      </span>
                    )}
                    {!product.is_active && (
                      <span className="absolute top-3 right-3 bg-slate-800 text-slate-300 text-xs font-bold px-2 py-1 rounded">
                        INACTIVE
                      </span>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-white text-lg line-clamp-1">
                        {product.name}
                      </h3>
                    </div>

                    <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                      {product.description || "No description"}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                      <span className="px-2 py-1 bg-slate-800 rounded">
                        {getCategoryName(product.category_id)}
                      </span>
                      <span className="px-2 py-1 bg-slate-800 rounded">
                        {getBrandName(product.brand_id)}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-2xl font-bold text-emerald-400">
                        Rs.{product.selling_price?.toLocaleString() || "0"}
                      </span>
                      {product.purchase_price && (
                        <span className="text-sm text-slate-500 line-through mb-1">
                          Rs.{product.purchase_price.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Stock */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-xs font-medium ${
                        product.stock_quantity <= product.minimum_stock
                          ? "text-red-400"
                          : "text-emerald-400"
                      }`}>
                        Stock: {product.stock_quantity || 0}
                      </span>
                      <span className="text-xs text-slate-500">
                        SKU: {product.sku || "N/A"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="flex-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(product._id)}
                        className="flex-1 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Products Table View */}
      {viewMode === "table" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr className="text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Brand</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                      Loading products...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                      Koi product nahi mila.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product._id} className="hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-12 h-12 rounded-lg object-cover border border-slate-700"
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded-lg ${getAvatarColor(product.name)} flex items-center justify-center text-white font-bold`}>
                              {getInitials(product.name)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-white">{product.name}</p>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {product.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {product.sku || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                        {getCategoryName(product.category_id)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                        {getBrandName(product.brand_id)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-emerald-400">
                            Rs.{product.selling_price?.toLocaleString()}
                          </p>
                          {product.purchase_price && (
                            <p className="text-xs text-slate-500 line-through">
                              Rs.{product.purchase_price.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={product.stock_quantity <= product.minimum_stock ? "text-red-400 font-medium" : "text-emerald-400"}>
                          {product.stock_quantity || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                          product.is_active
                            ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                            : "bg-red-900/40 text-red-300 border border-red-800"
                        }`}>
                          {product.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 hover:bg-blue-900/40 rounded-lg transition text-slate-400 hover:text-blue-400"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(product._id)}
                            className="p-2 hover:bg-red-900/40 rounded-lg transition text-slate-400 hover:text-red-400"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h3>
                <p className="text-sm text-slate-400">
                  {editingProduct ? "Update product details" : "Fill in the product details"}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Product Code *
                  </label>
                  <input
                    type="text"
                    value={formData.product_code}
                    onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                    placeholder="PRD-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                    placeholder="SKU-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                  placeholder="Wireless Earbuds"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                  placeholder="Product description..."
                />
              </div>

              {/* Category & Brand */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Brand *
                  </label>
                  <select
                    value={formData.brand_id}
                    onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">Select Brand</option>
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Purchase Price (Rs.) *
                  </label>
                  <input
                    type="number"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Selling Price (Rs.) *
                  </label>
                  <input
                    type="number"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                    placeholder="1500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Stock */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Minimum Stock Level
                  </label>
                  <input
                    type="number"
                    value={formData.minimum_stock}
                    onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                    placeholder="10"
                  />
                </div>
              </div>

              {/* Image & Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-600"
                    />
                    <span className="text-sm text-slate-300">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-600"
                    />
                    <span className="text-sm text-slate-300">Featured</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition shadow-lg shadow-emerald-900/30"
                >
                  {editingProduct ? "Update Product" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}