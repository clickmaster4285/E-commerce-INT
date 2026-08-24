const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Employee = require("../models/Employee");

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
  banners: oldPerms?.banners ?? true,
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
    "banners",
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
    const employees = await Employee.find({
      is_deleted: false,
    })
      .populate({
        path: "userId",
        select:
          "name email phone role status avatar permissions twoFactorEnabled created_at",
      })
      .sort({
        created_at: -1,
      })
      .lean();

    const validEmployees = employees.filter(
      (employee) => employee.userId !== null
    );

    for (const employee of validEmployees) {
      if (!employee.userId) continue;

      if (needsPermissionMigration(employee.userId.permissions)) {
        const fixedPermissions = fixPermissions(
          employee.userId.permissions || {}
        );

        await User.findByIdAndUpdate(
          employee.userId._id,
          {
            $set: {
              permissions: fixedPermissions,
            },
          }
        );

        employee.userId.permissions = fixedPermissions;
      } else {
        employee.userId.permissions = fixPermissions(
          employee.userId.permissions
        );
      }
    }

    return res.json({
      success: true,
      data: validEmployees,
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
      .populate({
        path: "userId",
        select: "-password -activities",
      })
      .lean();

    if (
      !employee ||
      employee.is_deleted ||
      !employee.userId
    ) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (
      needsPermissionMigration(
        employee.userId.permissions
      )
    ) {
      const fixedPermissions = fixPermissions(
        employee.userId.permissions || {}
      );

      await User.findByIdAndUpdate(
        employee.userId._id,
        {
          $set: {
            permissions: fixedPermissions,
          },
        }
      );

      employee.userId.permissions = fixedPermissions;
    } else {
      employee.userId.permissions = fixPermissions(
        employee.userId.permissions
      );
    }

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
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required",
      });
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    const existing = await User.findOne({
      email: normalizedEmail,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const performerId =
      req.user?._id ||
      req.user?.id ||
      null;

    const performerName =
      req.user?.name ||
      "Admin";

    const emailPrefix = normalizedEmail
      .split("@")[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

    const autoUsername = `${emailPrefix}_${Date.now().toString(
      36
    )}`;

    const usernameExists =
      await User.findOne({
        username: autoUsername,
      });

    const finalUsername = usernameExists
      ? `${autoUsername}_${Math.random()
          .toString(36)
          .substring(2, 6)}`
      : autoUsername;

    // ---------------------------------------------
    // CREATE USER
    // ---------------------------------------------

    const newUser = await User.create({
      name,
      email: normalizedEmail,
      username: finalUsername,
      password: hashedPassword,
      phone: phone || "",
      role,
      status,
      permissions: fixPermissions(
        permissions || {}
      ),
      createdby: performerId,
    });

    // ---------------------------------------------
    // CREATE EMPLOYEE
    // ---------------------------------------------

    const count =
      await Employee.countDocuments({});

    const newEmployee =
      await Employee.create({
        userId: newUser._id,
        employeeCode: `EMP-${String(
          count + 1
        ).padStart(5, "0")}`,
        department: department || "",
        createdby: performerId,
      });

    // ---------------------------------------------
    // LINK EMPLOYEE TO USER
    // ---------------------------------------------

    newUser.employeeId =
      newEmployee._id;

    await newUser.save();

    // ---------------------------------------------
    // ACTIVITY
    // ---------------------------------------------

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
      userId: newUser.toObject(),
    };

    delete result.userId.password;

    // ---------------------------------------------
    // SOCKET
    // ---------------------------------------------

    if (req.io) {
      req.io.emit(
        "employeeCreated",
        {
          success: true,
          data: result,
        }
      );
    }

    return res.json({
      success: true,
      message: "Employee created",
      data: result,
    });
  } catch (error) {
    console.error(
      "❌ createEmployee error:",
      error.message
    );

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

    const employee =
      await Employee.findById(id).populate(
        "userId"
      );

    if (
      !employee ||
      !employee.userId
    ) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const targetUserId =
      employee.userId._id.toString();

    // =================================================
    // SELF PERMISSION PROTECTION
    // =================================================

    if (
      currentUserId === targetUserId &&
      updates.permissions &&
      Object.keys(updates.permissions).length
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot modify your own permissions. Please contact an administrator.",
      });
    }

    const performerId =
      req.user?._id ||
      req.user?.id ||
      null;

    const performerName =
      req.user?.name ||
      "Admin";

    const changes = [];

    // =================================================
    // EMPLOYEE FIELDS
    // =================================================

    const employeeFields = [
      "department",
      "address",
      "dateOfBirth",
    ];

    const employeeUpdates = {};

    for (const field of employeeFields) {
      if (
        updates[field] !== undefined &&
        String(employee[field] ?? "") !==
          String(updates[field] ?? "")
      ) {
        changes.push({
          field,
          oldValue:
            employee[field] || "(empty)",
          newValue:
            updates[field] || "(empty)",
        });

        employeeUpdates[field] =
          updates[field];
      }
    }

    // =================================================
    // USER FIELDS
    // =================================================

    const userFields = [
      "name",
      "email",
      "phone",
      "status",
      "role",
    ];

    const userUpdates = {};

    for (const field of userFields) {
      if (
        updates[field] !== undefined &&
        String(
          employee.userId[field] ?? ""
        ) !==
          String(updates[field] ?? "")
      ) {
        changes.push({
          field,
          oldValue:
            employee.userId[field] ||
            "(empty)",
          newValue:
            updates[field] ||
            "(empty)",
        });

        userUpdates[field] =
          updates[field];
      }
    }

    // =================================================
    // PASSWORD
    // =================================================

    if (
      updates.password &&
      String(updates.password).trim()
    ) {
      userUpdates.password =
        await bcrypt.hash(
          String(updates.password),
          10
        );

      changes.push({
        field: "password",
        oldValue: "••••••",
        newValue: "••••••",
      });
    }

    // =================================================
    // PERMISSIONS
    // =================================================

    let permissionsChanged = false;

    const currentPermissions =
      fixPermissions(
        employee.userId.permissions || {}
      );

    if (
      updates.permissions &&
      typeof updates.permissions === "object"
    ) {
      const mergedPermissions =
        fixPermissions({
          ...currentPermissions,
          ...updates.permissions,
        });

      const permissionKeys = [
        "employees",
        "products",
        "brands",
        "categories",
        "profile",
        "store",
        "discounts",
        "deals",
        "banners",
      ];

      for (const key of permissionKeys) {
        if (
          currentPermissions[key] !==
          mergedPermissions[key]
        ) {
          permissionsChanged = true;

          changes.push({
            field: `permission.${key}`,
            oldValue:
              currentPermissions[key]
                ? "Enabled"
                : "Disabled",
            newValue:
              mergedPermissions[key]
                ? "Enabled"
                : "Disabled",
          });
        }
      }

      userUpdates.permissions =
        mergedPermissions;
    }

    // =================================================
    // UPDATED BY
    // =================================================

    if (
      Object.keys(userUpdates).length > 0
    ) {
      userUpdates.updatedby =
        performerId;
    }

    if (
      Object.keys(employeeUpdates).length > 0
    ) {
      employeeUpdates.updatedby =
        performerId;
    }

    // =================================================
    // UPDATE USER
    // =================================================

    if (
      Object.keys(userUpdates).length > 0
    ) {
      await User.findByIdAndUpdate(
        employee.userId._id,
        {
          $set: userUpdates,
        },
        {
          new: true,
        }
      );
    }

    // =================================================
    // UPDATE EMPLOYEE
    // =================================================

    if (
      Object.keys(employeeUpdates).length > 0
    ) {
      await Employee.findByIdAndUpdate(
        id,
        {
          $set: employeeUpdates,
        },
        {
          new: true,
        }
      );
    }

    // =================================================
    // ACTIVITY
    // =================================================

    const actionMsg =
      changes.length > 0
        ? `${performerName} updated ${changes
            .map((change) => change.field)
            .join(
              ", "
            )} for ${employee.userId.name}`
        : `${performerName} updated ${employee.userId.name}'s profile`;

    await pushActivity(
      employee._id,
      {
        action: actionMsg,
        category:
          "Employee Management",
        performedBy:
          performerId,
        performedByName:
          performerName,
        details: {
          changes,
        },
      }
    );

    // =================================================
    // GET FRESH EMPLOYEE
    // =================================================

    const updatedEmployee =
      await Employee.findById(id)
        .populate({
          path: "userId",
          select:
            "-password -activities",
        })
        .lean();

    if (
      updatedEmployee?.userId
    ) {
      updatedEmployee.userId.permissions =
        fixPermissions(
          updatedEmployee.userId.permissions
        );
    }

    // =================================================
    // SOCKET BROADCAST
    // =================================================

    if (req.io) {
      // All employees/admin panels
      req.io.emit(
        "employeeUpdated",
        {
          success: true,
          data: updatedEmployee,
        }
      );

      // Target employee
      req.io
        .to(
          `employee:${targetUserId}`
        )
        .emit(
          "employeeUpdated",
          {
            success: true,
            data: updatedEmployee,
          }
        );

      // ---------------------------------------------
      // IMPORTANT:
      // Send fresh DB permissions to target user
      // ---------------------------------------------

      if (permissionsChanged) {
        const permissionPayload = {
          userId: targetUserId,
          permissions:
            updatedEmployee?.userId
              ?.permissions || {},
          role:
            updatedEmployee?.userId
              ?.role || "staff",
        };

        console.log(
          "🔐 Sending fresh permissions:",
          permissionPayload
        );

        req.io
          .to(
            `employee:${targetUserId}`
          )
          .emit(
            "permissionsUpdated",
            permissionPayload
          );

        // Additional event for frontend auth/context
        req.io
          .to(
            `employee:${targetUserId}`
          )
          .emit(
            "authPermissionsUpdated",
            permissionPayload
          );
      }
    }

    return res.json({
      success: true,
      message:
        "Employee updated successfully",
      data: updatedEmployee,
      permissions:
        updatedEmployee?.userId
          ?.permissions || {},
      permissionsChanged,
    });
  } catch (error) {
    console.error(
      "❌ updateEmployee error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
      ).populate("userId");

    if (
      !employee ||
      !employee.userId
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Employee not found",
      });
    }

    const oldStatus =
      employee.userId.status;

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

    await User.findByIdAndUpdate(
      employee.userId._id,
      {
        $set: {
          status: newStatus,
          updatedby: performerId,
        },
      }
    );

    await pushActivity(
      employee._id,
      {
        action: `${performerName} ${
          newStatus === "active"
            ? "activated"
            : "deactivated"
        } ${employee.userId.name}'s account`,
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
        .populate({
          path: "userId",
          select:
            "-password -activities",
        })
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
          `employee:${employee.userId._id}`
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