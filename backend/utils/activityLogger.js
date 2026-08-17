const Activity = require("../models/Activity");

/**
 * Logs an activity to DB and broadcasts via Socket.IO in real-time
 */
const logActivity = async (io, data) => {
  try {
    const {
      userId,
      targetUserId = null,
      action,
      category = "System",
      details = {},
      ipAddress = null,
      userAgent = null,
    } = data;

    if (!userId || !action) {
      console.warn("⚠️  Activity log skipped: missing userId or action");
      return null;
    }

    // 1. Save to Database
    const activity = await Activity.create({
      user: userId,
      targetUser: targetUserId,
      action,
      category,
      details,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    });

    // 2. Populate user info
    const populated = await activity.populate([
      { path: "user", select: "name email avatar role" },
      { path: "targetUser", select: "name email avatar role" },
    ]);

    // 3. Broadcast to ALL connected clients
    if (io) {
      io.emit("activity:new", populated);

      // Also emit to specific employee room
      if (targetUserId) {
        io.to(`employee:${targetUserId}`).emit("employee:activity", populated);
      }

      // Emit to activities room
      io.to("activities").emit("activity:new", populated);
    }

    console.log(`📝 Activity logged: ${action}`);
    return populated;
  } catch (error) {
    console.error("❌ Activity log error:", error.message);
    return null;
  }
};

/**
 * Compare old and new data to generate human-readable changes
 */
const getChanges = (oldData, newData, fieldsToTrack) => {
  const changes = [];

  fieldsToTrack.forEach((field) => {
    const oldVal = oldData?.[field];
    const newVal = newData?.[field];

    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changes.push({
        field,
        oldValue: oldVal === undefined || oldVal === null || oldVal === "" ? "(empty)" : oldVal,
        newValue: newVal === undefined || newVal === null || newVal === "" ? "(empty)" : newVal,
      });
    }
  });

  return changes;
};

module.exports = { logActivity, getChanges };