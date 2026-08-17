const bcrypt = require("bcryptjs");
const User = require("../models/User");

const pushActivity = async (employeeId, activityData) => {
  try {
    await User.findByIdAndUpdate(employeeId, {
      $push: {
        activities: {
          $each: [{ ...activityData, timestamp: new Date() }],
          $position: 0,
          $slice: 100,
        },
      },
    });
  } catch (err) {
    console.error("⚠️  pushActivity error:", err.message);
  }
};

// ✅ FIXED: Ensure all 6 permissions are always present
const fixPermissions = (oldPerms) => {
  return {
    employees: oldPerms.employees !== undefined ? oldPerms.employees : true,
    products: oldPerms.products !== undefined ? oldPerms.products : true,
    brands: oldPerms.brands !== undefined ? oldPerms.brands : true,
    categories: oldPerms.categories !== undefined ? oldPerms.categories : true,
    profile: oldPerms.profile !== undefined ? oldPerms.profile : true,
    store: oldPerms.store !== undefined ? oldPerms.store : false,
  };
};

const needsPermissionMigration = (perms) => {
  if (!perms) return true;
  return (
    perms.users !== undefined ||
    perms.orders !== undefined ||
    perms.settings !== undefined ||
    perms.dashboard !== undefined
  );
};

exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({
      role: { $in: ["staff", "manager"] },
      is_deleted: false,
    })
      .select("-password -activities")
      .sort({ created_at: -1 })
      .lean();

    for (const emp of employees) {
      if (needsPermissionMigration(emp.permissions)) {
        emp.permissions = fixPermissions(emp.permissions || {});
        User.findByIdAndUpdate(emp._id, { permissions: emp.permissions }).catch(() => {});
      }
    }

    return res.json({ success: true, data: employees });
  } catch (error) {
    console.error("❌ getAllEmployees error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const id = req.params.id || req.params._id;
    const employee = await User.findById(id).select("-password").lean();

    if (!employee || employee.is_deleted) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    if (!Array.isArray(employee.activities)) employee.activities = [];

    if (needsPermissionMigration(employee.permissions)) {
      employee.permissions = fixPermissions(employee.permissions || {});
      await User.findByIdAndUpdate(id, { permissions: employee.permissions });
      console.log(`✅ Auto-fixed permissions for: ${employee.name}`);
    }

    return res.json({ success: true, data: employee });
  } catch (error) {
    console.error("❌ getEmployeeById error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const { name, email, password, phone, department, role = "staff", status = "active", permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const count = await User.countDocuments({ role: { $in: ["staff", "manager"] } });
    const employeeId = `EMP-${String(count + 1).padStart(5, "0")}`;

    const performerId = req.user?._id || req.user?.id || null;
    const performerName = req.user?.name || "Admin";

    const defaultPermissions = {
      employees: true,
      products: true,
      brands: true,
      categories: true,
      profile: true,
      store: false,
    };

    const newEmployee = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone || "",
      department: department || "",
      role,
      status,
      employeeId,
      permissions: permissions ? fixPermissions(permissions) : defaultPermissions,
      createdby: performerId,
      activities: [
        {
          action: `Employee account created by ${performerName}`,
          category: "Employee Management",
          performedBy: performerId,
          performedByName: performerName,
          details: { name, email, department, role },
          timestamp: new Date(),
        },
      ],
    });

    const result = newEmployee.toObject();
    delete result.password;

    if (req.io) {
      req.io.emit("employeeCreated", { success: true, data: result });
    }

    return res.json({ success: true, message: "Employee created", data: result });
  } catch (error) {
    console.error("❌ createEmployee error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;

    const currentUserId = req.user?._id?.toString();
    if (currentUserId === id && updates.permissions) {
      return res.status(403).json({
        success: false,
        message: "You cannot modify your own permissions. Please contact an administrator.",
      });
    }

    const oldEmployee = await User.findById(id);
    if (!oldEmployee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const trackedFields = ["name", "email", "phone", "department", "status", "role", "address", "dateOfBirth"];
    const changes = [];
    trackedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        const oldVal = oldEmployee[field];
        const newVal = updates[field];
        if (String(oldVal ?? "") !== String(newVal ?? "")) {
          changes.push({
            field,
            oldValue: oldVal === undefined || oldVal === null || oldVal === "" ? "(empty)" : oldVal,
            newValue: newVal === undefined || newVal === null || newVal === "" ? "(empty)" : newVal,
          });
        }
      }
    });

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
      changes.push({ field: "password", oldValue: "••••••", newValue: "••••••" });
    }

    let permissionsChanged = false;
    if (updates.permissions) {
      const oldPerms = oldEmployee.permissions || {};
      const mergedPerms = { ...oldPerms, ...updates.permissions };
      const newPerms = fixPermissions(mergedPerms);

      console.log("🔍 DEBUG Permissions Update:", {
        oldPerms,
        receivedPerms: updates.permissions,
        mergedPerms,
        newPerms,
      });

      updates.permissions = newPerms;

      const permChanges = [];
      Object.keys(newPerms).forEach((key) => {
        if (oldPerms[key] !== newPerms[key]) {
          permChanges.push({
            field: `permission.${key}`,
            oldValue: oldPerms[key] ? "Enabled" : "Disabled",
            newValue: newPerms[key] ? "Enabled" : "Disabled",
          });
        }
      });
      if (permChanges.length > 0) {
        changes.push(...permChanges);
        permissionsChanged = true;
      }
    }

    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) delete updates[key];
    });

    updates.updatedby = req.user?._id || req.user?.id || null;

    const performerId = req.user?._id || req.user?.id || null;
    const performerName = req.user?.name || "Admin";

    let actionMsg;
    if (changes.length > 0) {
      const changedFields = changes.map((c) => c.field).join(", ");
      actionMsg = `${performerName} updated ${changedFields} for ${oldEmployee.name}`;
    } else {
      actionMsg = `${performerName} updated ${oldEmployee.name}'s profile`;
    }

    const updatedDoc = await User.findByIdAndUpdate(
      id,
      {
        $set: updates,
        $push: {
          activities: {
            $each: [
              {
                action: actionMsg,
                category: "Employee Management",
                performedBy: performerId,
                performedByName: performerName,
                details: { changes },
                timestamp: new Date(),
              },
            ],
            $position: 0,
            $slice: 100,
          },
        },
      },
      { new: true, runValidators: true }
    )
      .select("-password")
      .lean();

    if (!updatedDoc) {
      return res.status(404).json({ success: false, message: "Employee not found after update" });
    }

    if (req.io) {
      req.io.emit("employeeUpdated", { success: true, data: updatedDoc });
      req.io.to(`employee:${id}`).emit("employeeUpdated", { success: true, data: updatedDoc });

      if (permissionsChanged) {
        // ✅ Emit to specific employee's room (targeted)
        req.io.to(`employee:${id}`).emit("permissionsUpdated", {
          userId: updatedDoc._id.toString(),
          permissions: updatedDoc.permissions || {},
          role: updatedDoc.role,
        });

        // ✅ Also broadcast globally (fallback for any listener)
        req.io.emit("permissionsUpdated", {
          userId: updatedDoc._id.toString(),
          permissions: updatedDoc.permissions || {},
          role: updatedDoc.role,
        });

        console.log(`🔔 Emitted permissionsUpdated for user ${updatedDoc._id}:`, updatedDoc.permissions);
      }
    }

    return res.json({ success: true, message: "Employee updated successfully", data: updatedDoc });
  } catch (error) {
    console.error("❌ updateEmployee error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const id = req.params.id;
    const employee = await User.findById(id);

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    await User.findByIdAndDelete(id);

    if (req.io) {
      req.io.emit("employeeDeleted", { success: true, data: { id } });
    }

    return res.json({ success: true, message: "Employee deleted" });
  } catch (error) {
    console.error("❌ deleteEmployee error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const employee = await User.findById(id);

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const newStatus = employee.status === "active" ? "inactive" : "active";
    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || req.user?.id || null;

    const updated = await User.findByIdAndUpdate(
      id,
      {
        $set: { status: newStatus },
        $push: {
          activities: {
            $each: [
              {
                action: `${performerName} ${newStatus === "active" ? "activated" : "deactivated"} ${employee.name}'s account`,
                category: "Employee Management",
                performedBy: performerId,
                performedByName: performerName,
                details: { previousStatus: employee.status, newStatus },
                timestamp: new Date(),
              },
            ],
            $position: 0,
            $slice: 100,
          },
        },
      },
      { new: true }
    )
      .select("-password")
      .lean();

    if (req.io) {
      req.io.emit("employeeStatusToggled", { success: true, data: updated });
      req.io.to(`employee:${id}`).emit("employeeStatusToggled", { success: true, data: updated });
    }

    return res.json({ success: true, message: "Status toggled", data: updated });
  } catch (error) {
    console.error("❌ toggleStatus error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};