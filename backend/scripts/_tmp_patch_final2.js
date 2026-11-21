const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect("mongodb://localhost:27017/ecommerce");
  const db = mongoose.connection.db;
  const hash = await bcrypt.hash("123456", 10);
  const r = await db.collection("pendingregistrations").updateOne({ email: "sellere2efinal2@example.com" }, { $set: { otpHash: hash, attempts: 0 } });
  console.log("patched:", r.modifiedCount);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
