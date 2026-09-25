const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { validatePhone } = require("../utils/phoneValidator");

// =====================================================
// ACTIVITY HELPER
// =====================================================

const pushActivity = async (employeeDocId, activityData) => {
  try {
    if (!employeeDocId) return;

    await Employee.findByIdAndUpdate(employeeDocId, {
      $push: {
        activities: {
          $each: [
            {
              ...activityData,
              timestamp: new Date(),
            },
          ],
          $position: 0,
          $slice: 100,
        },
      },
    });
  } catch (err) {
    console.error("⚠️ pushActivity error:", err.message);
  }
};

// =====================================================
// PERMISSION HELPER
// =====================================================

const fixPermissions = (oldPerms = {}) => ({
  employees: oldPerms?.employees ?? true,
  products: oldPerms?.products ?? true,
  brands: oldPerms?.brands ?? true,
  categories: oldPerms?.categories ?? true,
  profile: oldPerms?.profile ?? true,
  store: oldPerms?.store ?? false,
  discounts: oldPerms?.discounts ?? true,
  deals: oldPerms?.deals ?? true,
  bundles: oldPerms?.bundles ?? true,
  banners: oldPerms?.banners ?? true,
  manageStock: oldPerms?.manageStock ?? false,
  shipping: oldPerms?.shipping ?? false,
  order: oldPerms?.order ?? true,
  attribute: oldPerms?.attribute ?? true,
});

const needsPermissionMigration = (perms) => {
  if (!perms || typeof perms !== "object") {
    return true;
  }

  // Old permission keys
  const oldKeys = [
    "users",
    "orders",
    "settings",
    "dashboard",
  ];

  if (oldKeys.some((key) => perms[key] !== undefined)) {
    return true;
  }

  // New permission keys missing
  const requiredKeys = [
    "employees",
    "products",
    "brands",
    "categories",
    "profile",
    "store",
    "discounts",
    "deals",
    "bundles",
    "banners",
    "manageStock",
    "shipping",
    "order",
    "attribute",
  ];

  return requiredKeys.some(
    (key) => typeof perms[key] !== "boolean"
  );
};

// =====================================================
// GET ALL EMPLOYEES
// =====================================================

exports.getAllEmployees = async (req, res) => {
  try {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 0; // 0 = legacy mode
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const search = String(req.query.search || "").trim();
    const statusFilter = String(req.query.status || "all").trim();
    const departmentFilter = String(req.query.department || "all").trim();

    const filter = { is_deleted: false, role: { $ne: "admin" } };
    const conditions = [];
    if (search) {
      conditions.push({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      });
    }
    if (statusFilter && statusFilter !== "all") {
      conditions.push({ status: statusFilter });
    }
    if (conditions.length > 1) {
      filter.$and = conditions;
    } else if (conditions.length === 1) {
      Object.assign(filter, conditions[0]);
    }
    if (departmentFilter && departmentFilter !== "all") {
      filter.department = departmentFilter;
    }

    // ---- LEGACY MODE (no limit) -> exact old behavior ----
    if (!limit) {
      const employees = await Employee.find(filter)
        .populate("createdby", "name email")
        .populate("updatedby", "name email")
        .sort({
          created_at: -1,
        })
        .lean();

      // No userId filter — all employees are valid now
      const validEmployees = employees.filter(
        (employee) => employee !== null
      );

      for (const employee of validEmployees) {
        // Fix permissions directly on employee record
        employee.permissions = fixPermissions(
          employee.permissions || {}
        );
      }

      return res.json({
        success: true,
        data: validEmployees,
      });
    }

    // ---- PAGINATED MODE ----
    const total = await Employee.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages || 1);
    const skip = (safePage - 1) * limit;

    const employees = await Employee.find(filter)
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // All employees valid — no userId dependency
    const validEmployees = employees.filter(
      (employee) => employee !== null
    );

    for (const employee of validEmployees) {
      employee.permissions = fixPermissions(
        employee.permissions || {}
      );
    }

    return res.json({
      success: true,
      data: validEmployees,
      pagination: {
        total,
        page: safePage,
        limit,
        pages,
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      },
    });
  } catch (error) {
    console.error(
      "❌ getAllEmployees error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// GET EMPLOYEE BY ID
// =====================================================

exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(
      req.params.id
    )
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();

    if (
      !employee ||
      employee.is_deleted
    ) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Fix permissions directly
    employee.permissions = fixPermissions(
      employee.permissions || {}
    );

    if (!Array.isArray(employee.activities)) {
      employee.activities = [];
    }

    return res.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error(
      "❌ getEmployeeById error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// CREATE EMPLOYEE
// =====================================================

exports.createEmployee = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      department,
      role = "staff",
      status = "active",
      permissions,
      username,
      avatar,
      preferences,
      twoFactorEnabled,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    let sanitizedPhone = "";
    if (phone) {
      const phoneResult = validatePhone(phone, { min: 6, max: 15 });
      if (!phoneResult.valid) {
        return res.status(400).json({ success: false, message: phoneResult.message });
      }
      sanitizedPhone = phoneResult.sanitized;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check employee email uniqueness (not User)
    const existingEmployee = await Employee.findOne({
      email: normalizedEmail,
    });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const performerId = req.user?._id || req.user?.id || null;
    const performerName = req.user?.name || "Admin";

    const emailPrefix = normalizedEmail
      .split("@")[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    const autoUsername = username || `${emailPrefix}_${Date.now().toString(36)}`;

    const usernameExists = await Employee.findOne({ username: autoUsername });
    const finalUsername = usernameExists
      ? `${autoUsername}_${Math.random().toString(36).substring(2, 6)}`
      : autoUsername;

    const count = await Employee.countDocuments({});

    const newEmployee = await Employee.create({
      name,
      email: normalizedEmail,
      username: finalUsername,
      password: hashedPassword,
      phone: sanitizedPhone,
      role,
      status,
      avatar: avatar || "",
      permissions: fixPermissions(permissions || {}),
      preferences: preferences || { darkMode: true, notifications: { email: true, push: true, weekly: true } },
      twoFactorEnabled: twoFactorEnabled || false,
      employeeCode: `EMP-${String(count + 1).padStart(5, "0")}`,
      department: department || "",
      createdby: performerId,
    });

    await pushActivity(
      newEmployee._id,
      {
        action: `Employee account created by ${performerName}`,
        category: "Employee Management",
        performedBy: performerId,
        performedByName: performerName,
        details: {
          name,
          email: normalizedEmail,
          department,
          role,
        },
      }
    );

    const result = {
      ...newEmployee.toObject(),
      userId: newEmployee.toObject(),
    };
    delete result.userId.password;

    if (req.io) {
      req.io.emit("employeeCreated", {
        success: true,
        data: result,
      });
    }

    return res.json({
      success: true,
      message: "Employee created",
      data: result,
    });
  } catch (error) {
    console.error("❌ createEmployee error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// UPDATE EMPLOYEE
// =====================================================

exports.updateEmployee = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body || {};

    const currentUserId = (
      req.user?._id ||
      req.user?.id ||
      ""
    ).toString();

    const employee = await Employee.findById(id);

    if (
      !employee ||
      employee.is_deleted
    ) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const targetEmployeeId = employee._id.toString();

    // Self permission protection
    if (
      currentUserId === targetEmployeeId &&
      updates.permissions &&
      Object.keys(updates.permissions).length
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot modify your own permissions. Please contact an administrator.",
      });
    }

    const performerId = req.user?._id || req.user?.id || null;
    const performerName = req.user?.name || "Admin";
    const changes = [];

    const employeeFields = [
      "department",
      "address",
      "dateOfBirth",
    ];
    const employeeUpdates = {};

    for (const field of employeeFields) {
      if (
        updates[field] !== undefined &&
        String(employee[field] ?? "") !== String(updates[field] ?? "")
      ) {
        changes.push({
          field,
          oldValue: employee[field] || "(empty)",
          newValue: updates[field] || "(empty)",
        });
        employeeUpdates[field] = updates[field];
      }
    }

    // Username: blank = no change; validate format + uniqueness
    if (updates.username !== undefined) {
      const nextUsername = String(updates.username).trim().toLowerCase();
      if (!nextUsername || !/^[a-zA-Z0-9_]+$/.test(nextUsername)) {
        return res.status(400).json({
          success: false,
          message: "Username is required and can only contain letters, numbers, and underscores",
        });
      }
      if (nextUsername !== String(employee.username || "").toLowerCase()) {
        const usernameTaken = await Employee.findOne({
          username: nextUsername,
          _id: { $ne: employee._id },
        });
        if (usernameTaken) {
          return res.status(400).json({
            success: false,
            message: "This username is already taken",
          });
        }
      }
      updates.username = nextUsername;
    }

    const userFields = ["name", "username", "email", "phone", "status", "role"];
    const directUpdates = {};

    for (const field of userFields) {
      if (
        updates[field] !== undefined &&
        String(employee[field] ?? "") !== String(updates[field] ?? "")
      ) {
        if (field === "phone") {
          const phoneResult = validatePhone(updates[field], { min: 6, max: 15 });
          if (!phoneResult.valid) {
            return res.status(400).json({ success: false, message: phoneResult.message });
          }
          changes.push({
            field,
            oldValue: employee[field] || "(empty)",
            newValue: phoneResult.sanitized || "(empty)",
          });
          directUpdates[field] = phoneResult.sanitized;
        } else {
          changes.push({
            field,
            oldValue: employee[field] || "(empty)",
            newValue: updates[field] || "(empty)",
          });
          directUpdates[field] = updates[field];
        }
      }
    }

    // Password
    if (updates.password && String(updates.password).trim()) {
      const currentEmployee = await Employee.findById(id).select("password");
      if (currentEmployee && currentEmployee.password) {
        const samePassword = await bcrypt.compare(String(updates.password), currentEmployee.password);
        if (samePassword) {
          return res.status(400).json({
            success: false,
            message: "New password must be different from your current password.",
          });
        }
      }
      directUpdates.password = await bcrypt.hash(String(updates.password), 10);
      changes.push({ field: "password", oldValue: "••••••", newValue: "••••••" });
    }

    // Permissions
    let permissionsChanged = false;
    const currentPermissions = fixPermissions(employee.permissions || {});

    if (updates.permissions && typeof updates.permissions === "object") {
      const mergedPermissions = fixPermissions({ ...currentPermissions, ...updates.permissions });
      const permissionKeys = [
        "employees", "products", "brands", "categories", "profile",
        "store", "discounts", "deals", "bundles", "banners", "manageStock",
        "shipping", "order", "attribute",
      ];
      for (const key of permissionKeys) {
        if (currentPermissions[key] !== mergedPermissions[key]) {
          permissionsChanged = true;
          changes.push({
            field: `permission.${key}`,
            oldValue: currentPermissions[key] ? "Enabled" : "Disabled",
            newValue: mergedPermissions[key] ? "Enabled" : "Disabled",
          });
        }
      }
      directUpdates.permissions = mergedPermissions;
    }

    // Updated by
    if (Object.keys(directUpdates).length > 0 || Object.keys(employeeUpdates).length > 0) {
      const finalUpdates = { ...directUpdates, ...employeeUpdates, updatedby: performerId };
      await Employee.findByIdAndUpdate(id, { $set: finalUpdates }, { new: true });
    }

    // Activity
    const actionMsg = changes.length > 0
      ? `${performerName} updated ${changes.map(c => c.field).join(", ")} for ${employee.name}`
      : `${performerName} updated ${employee.name}'s profile`;

    await pushActivity(employee._id, {
      action: actionMsg,
      category: "Employee Management",
      performedBy: performerId,
      performedByName: performerName,
      details: { changes },
    });

    const updatedEmployee = await Employee.findById(id)
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();

    if (updatedEmployee) {
      updatedEmployee.permissions = fixPermissions(updatedEmployee.permissions || {});
    }

    // Socket
    if (req.io) {
      req.io.emit("employeeUpdated", { success: true, data: updatedEmployee });
      req.io.to(`employee:${employee._id}`).emit("employeeUpdated", { success: true, data: updatedEmployee });
      if (permissionsChanged) {
        const permissionPayload = {
          userId: employee._id,
          permissions: updatedEmployee?.permissions || {},
          role: updatedEmployee?.role || "staff",
        };
        req.io.to(`employee:${employee._id}`).emit("permissionsUpdated", permissionPayload);
        req.io.to(`employee:${employee._id}`).emit("authPermissionsUpdated", permissionPayload);
      }
    }

    return res.json({
      success: true,
      message: "Employee updated successfully",
      data: updatedEmployee,
      permissions: updatedEmployee?.permissions || {},
      permissionsChanged,
    });
  } catch (error) {
    console.error("❌ updateEmployee error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// DELETE EMPLOYEE - SOFT DELETE
// =====================================================

exports.deleteEmployee = async (
  req,
  res
) => {
  try {
    const employee =
      await Employee.findById(
        req.params.id
      );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          "Employee not found",
      });
    }

    const performerId =
      req.user?._id ||
      req.user?.id ||
      null;

    employee.is_deleted = true;
    employee.deleted_at = new Date();
    employee.updatedby = performerId;

    await employee.save();

    if (employee.userId) {
      await User.findByIdAndUpdate(
        employee.userId,
        {
          $set: {
            is_deleted: true,
            deleted_at: new Date(),
            deletedby: performerId,
          },
        }
      );
    }

    if (req.io) {
      req.io.emit(
        "employeeDeleted",
        {
          success: true,
          data: {
            id: req.params.id,
          },
        }
      );
    }

    return res.json({
      success: true,
      message:
        "Employee deleted",
    });
  } catch (error) {
    console.error(
      "❌ deleteEmployee error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// TOGGLE STATUS
// =====================================================

exports.toggleStatus = async (
  req,
  res
) => {
  try {
    const employee =
      await Employee.findById(
        req.params.id
      );

    if (
      !employee ||
      employee.is_deleted
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Employee not found",
      });
    }

    const oldStatus = employee.status;
    const newStatus =
      oldStatus === "active"
        ? "inactive"
        : "active";

    const performerId =
      req.user?._id ||
      req.user?.id ||
      null;

    const performerName =
      req.user?.name ||
      "Admin";

    // Update directly on employee
    employee.status = newStatus;
    employee.updatedby = performerId;
    await employee.save();

    await pushActivity(
      employee._id,
      {
        action: `${performerName} ${
          newStatus === "active"
            ? "activated"
            : "deactivated"
        } ${employee.name}'s account`,
        category:
          "Employee Management",
        performedBy:
          performerId,
        performedByName:
          performerName,
        details: {
          previousStatus:
            oldStatus,
          newStatus,
        },
      }
    );

    const updated =
      await Employee.findById(
        req.params.id
      )
        .populate("createdby", "name email")
        .populate("updatedby", "name email")
        .lean();

    if (req.io) {
      req.io.emit(
        "employeeStatusToggled",
        {
          success: true,
          data: updated,
        }
      );

      req.io
        .to(
          `employee:${employee._id}`
        )
        .emit(
          "employeeStatusToggled",
          {
            success: true,
            data: updated,
          }
        );
    }

    return res.json({
      success: true,
      message:
        "Status toggled",
      data: updated,
    });
  } catch (error) {
    console.error(
      "❌ toggleStatus error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};