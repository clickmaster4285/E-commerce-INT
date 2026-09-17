const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('./models/Employee');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/ecommerce');
    const existing = await Employee.findOne({ email: 'admin@gmail.com' });
    if (existing) {
      console.log('Admin already exists in Employee:', existing.email);
      return;
    }
    const admin = await Employee.create({
      name: 'admin',
      username: 'admin',
      email: 'admin@gmail.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
      status: 'active',
      permissions: { products: true, brands: true, categories: true, users: true, orders: true, settings: true, profile: true, employees: true, discounts: true, deals: true, store: true, banners: true, manageStock: true, shipping: true, order: true, attribute: true },
      employeeCode: 'EMP-ADMIN',
    });
    console.log('Admin created in Employee collection:', admin.email, '| ID:', admin._id);
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
