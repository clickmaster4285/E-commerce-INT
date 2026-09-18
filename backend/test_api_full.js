const axios = require("axios");

async function testAPI() {
  const base = "http://localhost:5000/api";

  try {
    // Register
    const reg = await axios.post(`${base}/users/register`, {
      name: "API Test",
      username: "apitest",
      email: "api@test.com",
      password: "test1234",
      phone: "1234567890",
    });
    console.log("✅ Register:", reg.data.success ? "PASS" : "FAIL");

    // Login
    const login = await axios.post(`${base}/users/login`, {
      email: "api@test.com",
      password: "test1234",
    }, { withCredentials: true });
    console.log("✅ Login:", login.data.success ? "PASS" : "FAIL");

    const cookies = login.headers["set-cookie"] ? login.headers["set-cookie"].join("; ") : "";

    // Wishlist toggle
    const toggle = await axios.put(`${base}/users/wishlist/toggle`, { product_id: "507f1f77bcf86cd799439011" }, { headers: { Cookie: cookies }, withCredentials: true });
    console.log("✅ Wishlist toggle:", toggle.data.success ? "PASS" : "FAIL", toggle.data);

    // Get wishlist
    const wl = await axios.get(`${base}/users/wishlist`, { headers: { Cookie: cookies }, withCredentials: true });
    console.log("✅ Get wishlist:", wl.data.success ? "PASS" : "FAIL", wl.data);

    // Create checkout draft
    const draft = await axios.post(`${base}/users/checkout-drafts`, { step: 2, items: [{ test: 1 }] }, { headers: { Cookie: cookies }, withCredentials: true });
    console.log("✅ Checkout draft create:", draft.data.success ? "PASS" : "FAIL", draft.data);

    // Get checkout drafts
    const drafts = await axios.get(`${base}/users/checkout-drafts`, { headers: { Cookie: cookies }, withCredentials: true });
    console.log("✅ Get checkout drafts:", drafts.data.success ? "PASS" : "FAIL", drafts.data);

  } catch (e) {
    console.error("❌ API TEST ERROR:", e.response?.data || e.message);
  }
}

testAPI();
