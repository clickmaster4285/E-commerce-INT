require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Wishlist = require("./models/Wishlist");
const CheckoutDraft = require("./models/CheckoutDraft");
const Product = require("./models/Product");

const connectDB = require("./config/db");

async function runTest() {
  try {
    await connectDB();
    console.log("✅ DB connected");

    // Clean test data
    await User.deleteMany({ email: { $regex: "test@" } });
    await Wishlist.deleteMany({});
    await CheckoutDraft.deleteMany({});

    // Create test user
    const user = await User.create({
      name: "Test User",
      username: "testuser123",
      email: "test@test.com",
      password: "testpass123",
      role: "user",
    });
    console.log("✅ User created:", user._id.toString());

    // Check user refs exist
    console.log("User wishlist_ref:", user.wishlist_ref);
    console.log("User checkout_draft_ref:", user.checkout_draft_ref);

    // Create wishlist entry
    const wishlist = await Wishlist.create({
      user_id: user._id,
      products: [],
    });
    console.log("✅ Wishlist created:", wishlist._id.toString());

    // Link user to wishlist
    await User.findByIdAndUpdate(user._id, { wishlist_ref: wishlist._id });

    // Create checkout draft
    const checkout = await CheckoutDraft.create({
      user_id: user._id,
      drafts: [{
        step: 1,
        selectedKeys: ["key1"],
        items: [{ product: "test", qty: 1 }],
        saved: false,
      }],
    });
    console.log("✅ CheckoutDraft created:", checkout._id.toString());

    // Link user to checkout
    await User.findByIdAndUpdate(user._id, { checkout_draft_ref: checkout._id });

    // Verify links
    const updatedUser = await User.findById(user._id);
    console.log("✅ User wishlist_ref linked:", updatedUser.wishlist_ref?.toString() === wishlist._id.toString());
    console.log("✅ User checkout_draft_ref linked:", updatedUser.checkout_draft_ref?.toString() === checkout._id.toString());

    // Verify wishlist has user_id
    const wl = await Wishlist.findOne({ user_id: user._id });
    console.log("✅ Wishlist user_id link:", wl ? "YES" : "NO");

    // Verify checkout has user_id
    const cd = await CheckoutDraft.findOne({ user_id: user._id });
    console.log("✅ CheckoutDraft user_id link:", cd ? "YES" : "NO");
    console.log("✅ CheckoutDraft drafts array:", cd?.drafts?.length);

    console.log("\n=== ALL TESTS PASSED ===");
  } catch (err) {
    console.error("❌ TEST ERROR:", err.message);
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
