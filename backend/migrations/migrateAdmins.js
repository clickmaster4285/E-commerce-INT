const User = require("../models/User");
const Employee = require("../models/Employee");
const bcrypt = require("bcryptjs");

/**
 * One-time migration: Move existing admin/staff/manager users from users collection
 * into employees collection (self-contained records), then delete from users.
 * Call manually once: node -e "require('./migrations/migrateAdmins').run()"
 */
const migrateExistingAdmins = async () => {
  try {
    const adminUsers = await User.find({
      role: { $in: ["admin", "staff", "manager"] },
    }).lean();

    console.log(`Found ${adminUsers.length} admin/staff/manager accounts to migrate.`);

    for (const u of adminUsers) {
      const existingEmployee = await Employee.findOne({ email: u.email });
      if (existingEmployee) {
        console.log(`Skipping ${u.email} — already exists in employees.`);
        continue;
      }

      const employee = await Employee.create({
        name: u.name,
        username: u.username,
        email: u.email,
        password: u.password || await bcrypt.hash("temp1234", 10),
        phone: u.phone || "",
        role: u.role,
        status: u.status || "active",
        avatar: u.avatar || "",
        permissions: u.permissions || {
          products: true, brands: true, categories: true,
          users: false, orders: true, settings: true,
          profile: true, employees: true, discounts: true,
          deals: true, store: false, banners: true,
          manageStock: false, shipping: false, order: true, attribute: true,
        },
        preferences: u.preferences || { darkMode: true, notifications: { email: true, push: true, weekly: true } },
        twoFactorEnabled: u.twoFactorEnabled || false,
        storeId: u.storeId || null,
        employeeCode: `EMP-MIG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        department: u.department || "",
        createdby: u.createdby || null,
      });

      await User.deleteOne({ _id: u._id });
      console.log(`Migrated admin: ${u.email} -> employee ${employee._id}`);
    }

    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration error:", err.message);
  }
};

module.exports = { migrateExistingAdmins };
