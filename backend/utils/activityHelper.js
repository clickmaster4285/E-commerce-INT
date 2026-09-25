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

/**
 * Value ko stable string mein badalta hai (object ki key order se farq nahi padta,
 * array ki order preserve rehti hai). Audit fields (updated_at / updatedby) ko
 * sirf tab touch karne ke liye compare karte hain jab value waqai badli ho.
 */
const stableStringify = (value) => {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

/**
 * Deep comparison — order-sensitive (images jaisi lists ke liye).
 * FIX: isi se pata chalta hai ke user ne waqai kuch change kiya hai ya nahi,
 * warna same value dobara save karne par bhi "updated" event ban jata tha.
 */
const isSameValue = (a, b) => stableStringify(a) === stableStringify(b);

/**
 * Order-insensitive list comparison (tags ke liye).
 * Sirf re-order karne par "updated" nahi dikhana chahiye.
 */
const isSameList = (a, b) => {
  const norm = (list) =>
    Array.isArray(list) ? list.map((item) => String(item)).sort() : [];
  const left = norm(a);
  const right = norm(b);
  return left.length === right.length && left.every((v, i) => v === right[i]);
};

module.exports = {
  pushActivityToUser,
  pushGlobalActivity,
  getChanges,
  stableStringify,
  isSameValue,
  isSameList,
};
