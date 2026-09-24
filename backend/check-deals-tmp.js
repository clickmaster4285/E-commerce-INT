process.chdir("/home/clickmaster-linuxs/Desktop/ecomerce/backend");
require("dotenv").config({ path: "/home/clickmaster-linuxs/Desktop/ecomerce/backend/.env" });
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const docs = await db.collection("deals").find({}).limit(10).project({ title: 1, name: 1, createdBy: 1, createdby: 1, updatedBy: 1, updatedby: 1, createdAt: 1, created_at: 1 }).toArray();
  console.log(JSON.stringify(docs, null, 1));
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
