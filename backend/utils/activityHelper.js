const User = require("../models/User");

/**
 * Pushes activity to a specific user's array
 */
const pushActivityToUser = async (userId, activityData) => {
  try {
    if (!userId) return;
    await User.findByIdAndUpdate(userId, {
      $push: {
        activities: {
          $each: [{ ...activityData, timestamp: new Date() }],
          $position: 0, // Newest first
          $slice: 100,  // Keep last 100
        },
      },
    });
  } catch (err) {
    console.error("⚠️ pushActivityToUser error:", err.message);
  }
};

/**
 * Pushes activity to ALL admin/staff users and broadcasts via Socket
 */
const pushGlobalActivity = async (io, activityData, performerId) => {
  try {
    const { action, category, performedBy, performedByName, details } = activityData;

    // 1. Find all staff/admin users
    const users = await User.find({
      role: { $in: ["admin", "staff", "manager"] },
      is_deleted: false,
    }).select("_id");

    // 2. Save to their DB arrays (Atomic Update)
    await User.updateMany(
      { _id: { $in: users.map((u) => u._id) } },
      {
        $push: {
          activities: {
            $each: [{ action, category, performedBy, performedByName, details, timestamp: new Date() }],
            $position: 0,
            $slice: 100,
          },
        },
      }
    );

    // 3. Broadcast to everyone connected via Socket
    if (io) {
      io.emit("activity:new", {
        action,
        category,
        performedBy,
        performedByName,
        details,
        timestamp: new Date(),
        _id: Date.now().toString(), // Temp ID for React key
      });
    }
    
    console.log(`📝 Global Activity Logged: ${action}`);
  } catch (err) {
    console.error("⚠️ pushGlobalActivity error:", err.message);
  }
};

/**
 * Helper to compare old vs new data
 */
const getChanges = (oldData, newData, fields) => {
  const changes = [];
  fields.forEach((field) => {
    const oldVal = oldData?.[field];
    const newVal = newData?.[field];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changes.push({ field, oldValue: oldVal || "(empty)", newValue: newVal || "(empty)" });
    }
  });
  return changes;
};

module.exports = { pushActivityToUser, pushGlobalActivity, getChanges };