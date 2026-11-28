// ==========================================================
// invalidateOn(ns) — publicCache namespace(s) SUCCESSFUL mutation ke BAAD drop karo
// ----------------------------------------------------------
// Pehle `drop*Cache` middleware controller se PEHLE invalidate karte the:
//   drop → (concurrent GET purana data dobara cache kar leta) → controller write.
// Ab `res.on("finish")` par, sirf 2xx status par invalidate hota hai — failed/validation
// error par cache bekaar drop nahi hota, aur write commit hone ke baad hi drop hota hai.
//
// Store context: finish event ALS se bahar fire ho sakta hai, is liye storeId middleware
// time par capture karke runWithStore se invalidate chalate hain (sirf usi store ka cache).
// ==========================================================

const { invalidate } = require("../utils/publicCache");
const { getStoreId, runWithStore } = require("../utils/tenantContext");

function invalidateOn(namespaces) {
  const list = Array.isArray(namespaces) ? namespaces : [namespaces];
  return (req, res, next) => {
    const storeId = req.store?._id || getStoreId();
    let done = false;
    res.on("finish", () => {
      if (done) return;
      done = true;
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      try {
        if (storeId) runWithStore(storeId, () => invalidate(list));
        else invalidate(list);
      } catch (_) {
        // cache drop fail → response pehle hi ja chuka
      }
    });
    next();
  };
}

module.exports = { invalidateOn };
