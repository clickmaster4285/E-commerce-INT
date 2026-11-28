# 11 — Controllers Reference (function by function)

`backend/controllers/` me har controller kya karta hai aur uske kaunse functions hain.
Har entry: file → exported functions (route se call hote hain) + short purpose.

> Controllers thin-ish hain: validation + business logic + DB + socket emit. Store scoping
> `tenantScope` plugin khud karta hai, is liye controllers me `storeId` manually nahi bhejte.

---

## addressController.js
Customer address book.

| Function | Kaam |
|---|---|
| `getMyAddresses` | Logged-in customer ke saare addresses |
| `createAddress` | Naya address (required: full_name, street_address1, city, state, phone; phone validate) |
| `setDefaultAddress` | Ek address default mark (baaki default hatao) |
| `updateAddress` | Address edit (ownership check) |
| `deleteAddress` | Address delete |

## attributeController.js
Per-store product attributes (Color, RAM…) + category assignment.

| Function | Kaam |
|---|---|
| `getAttributes` | Paginated list (search/sort) |
| `getAttributeStats` | Counts + data types |
| `getAttributeById` | Detail |
| `createAttribute` | Naya attribute (values normalize) |
| `updateAttribute` | Edit (values rebuild, identity preserve) |
| `getAttributeCategories` | Attribute se linked categories |
| `updateAttributeCategories` | Category assignments replace |
| `deleteAttribute` | Soft delete |

Internal helpers: `normalizeValues`, `sanitizePayload`, `enrichAttributesWithCategories`, `emitSocket`.

## bannerController.js
Storefront banners.

| Function | Kaam |
|---|---|
| `getAllBanners` | Admin/public list |
| `getActiveBanners` | Active (date window) banners, `?limit` ≤50 |
| `getBanner` | Single banner |
| `createBanner` | Create (multipart images, position unique) |
| `updateBanner` | Update (old image delete) |
| `toggleStatus` | Active/inactive toggle |
| `duplicateBanner` | Copy banner |
| `deleteBanner` | Delete + file cleanup |

Auto-publish: `startDate` future → `scheduled`, ab/past → `active`. Cache invalidate + socket.

## brandController.js

| Function | Kaam |
|---|---|
| `getBrandsPublic` | Public brand list (60s cache) |
| `getBrandsAdmin` | Admin list |
| `getBrands` | Legacy list |
| `getBrandById` | Detail |
| `getBrandWithProducts` | Brand + uske products (storefront brand page) |
| `getNextBrandCode` | Next `BRD-###` |
| `createBrand` | Create + logo processing |
| `updateBrand` | Update |
| `deleteBrand` | Soft delete |

## bundleController.js
Combo bundles.

| Function | Kaam |
|---|---|
| `getActiveBundles` | Public active bundles (+pricing attach) |
| `getBundles` | Admin list |
| `getBundleById` | Detail |
| `createBundle` | Create (min 2, max 20 products; image required; price > 0) |
| `updateBundle` | Update |
| `deleteBundle` | Delete |
| `toggleBundleStatus` | Active toggle |

`attachPricing` original price/savings/discount% compute karta hai.

## cartController.js

| Function | Kaam |
|---|---|
| `getCart` | Customer ka cart items |
| `saveCart` | Cart full replace/upsert (per-user one cart) |

## categoryController.js
Hierarchical categories + attributes config.

| Function | Kaam |
|---|---|
| `getCategories` | Admin list (legacy full ya paginated) |
| `getCategoryById` | Detail |
| `getCategoryAttributes` | Assigned attributes |
| `getCategoryAttributesHierarchical` | Hierarchical attributes |
| `getNextCode` | Next category code |
| `createCategory` | Create (name required, code auto/unique, parent tree rules) |
| `updateCategory` | Update |
| `assignCategoryAttributes` | Attributes assign |
| `deleteCategory` | Soft delete |

`/public` aur `/admin/options`, `/admin/all` route me inline handlers hain (controller se nahi).

## chatController.js
Support chat (customer + guest + staff).

| Function | Kaam |
|---|---|
| `startGuest` | Guest conversation start/resume (token) |
| `getGuestMine` | Guest ki conversation |
| `requireGuestChat` | Guest token hash verify (middleware) |
| `canUseCustomerChat` | Customer chat access gate |
| `canUseInbox` | Staff inbox gate |
| `openGeneral` | Customer general chat (idempotent) |
| `openForOrder` | Order-specific chat (order ownership check) |
| `listMine` | Customer conversations |
| `unreadCount` | Staff unread count |
| `listAdmin` | Staff conversation list |
| `updateStatus` | Open/close conversation |
| `updateInquiryContext` | Inquiry topic/snapshot change |
| `getConversation` | Detail (authorize) |
| `getMessages` | Cursor messages |
| `sendMessage` | Message (≤4000, rate-limited, unread counters, socket) |
| `markRead` | Read stamp + unread clear |

Internal: `_buildMessageContext`, `authorize`.

## customerController.js
Offline/POS customer directory (storefront `User` se alag).

| Function | Kaam |
|---|---|
| `getCustomersAdmin` | Paginated list |
| `searchCustomers` | Quick search |
| `getCustomerById` | Detail |
| `createCustomer` | Create |
| `updateCustomer` | Update |
| `deleteCustomer` | Soft delete |

`syncLeadCustomer` linked leads sync karta hai.

## dashboardController.js

| Function | Kaam |
|---|---|
| `getDashboardStats` | KPIs + series (range `7d/30d/3m/6m/1y`) + pct change |

## dealController.js
Automatic promotions.

| Function | Kaam |
|---|---|
| `getActiveDeals` | Public active deals (30s cache) |
| `getActiveDealById` | Public single active deal |
| `getDeals` | Admin list |
| `getDealById` | Admin detail |
| `getDealTargets` | Target products/categories |
| `createDeal` | Create (bundle-rule sanitize, schedule) |
| `updateDeal` | Update |
| `deleteDeal` | Delete |
| `toggleDealStatus` | Active toggle |

## discountController.js
Coupon/promo codes.

| Function | Kaam |
|---|---|
| `getPublicDiscounts` | Public active discounts (60s cache) |
| `getDiscounts` | Admin list |
| `getDiscountById` | Detail |
| `getDiscountTargets` | Targets |
| `createDiscount` | Create (value ≥0, % ≤100, limits ≥0) |
| `updateDiscount` | Update |
| `deleteDiscount` | Delete |
| `calculateDiscountedPrice` | Shared pricing helper — **deal active ho to discount skip** (orders use karte hain) |

## employeeController.js
Store staff accounts.

| Function | Kaam |
|---|---|
| `getAllEmployees` | List (permission migration on read) |
| `getEmployeeActivities` | Activity log |
| `getEmployeeById` | Detail |
| `createEmployee` | Create (email unique, plan staff cap) |
| `updateEmployee` | Update (khud ki permission change blocked) |
| `deleteEmployee` | Soft delete (owner delete nahi) |
| `toggleStatus` | Active/inactive |

## financeController.js

| Function | Kaam |
|---|---|
| `getFinanceOverview` | Unified ledger: invoice payments/refunds, POS sales/refunds, paid orders, PO payments; `period` filter; cash-refund de-dup |

## invoiceController.js

| Function | Kaam |
|---|---|
| `listInvoices` | List (search/filter/paginate) |
| `getNextInvoiceNumber` | Next number |
| `createInvoice` | Create + atomic stock deduct (rollback) |
| `updateInvoice` | Update (sent ke baad blocked; stock deltas) |
| `getInvoice` | Detail |
| `sendInvoice` | `sent_at` set (idempotent) |
| `recordPayment` | Payment (amount ≤ remaining; status auto) |
| `recordReturn` | Return/refund (unreturned qty, restock, settlement, `__v` guard) |

## leadController.js
CRM leads.

| Function | Kaam |
|---|---|
| `listLeads` | List + stats (activities/history strip) |
| `createLead` | Create (phone 7–15 digits, Business needs company_name) |
| `getLead` | Detail + customer history |
| `updateLead` | Update |
| `updateStatus` | Status rules (Lost/Converted etc.) |
| `addActivity` | Call/WhatsApp/Email/Meeting interaction |
| `deleteLead` | Soft delete |

## loyaltyController.js

| Function | Kaam |
|---|---|
| `getProgram` | Public program settings |
| `getMyRewards` | Customer balance + transactions |
| `getMyNotices` | Unseen point notices |
| `markMyNoticesSeen` | Notices seen |
| `claimWelcomeBonus` | Welcome bonus claim (no double credit) |
| `getOverview` | 30-day admin overview |
| `getSettings` / `updateSettings` | Program settings (validation) |
| `listMembers` / `getMember` | Member list/detail (aggregation) |
| `adjustMember` | Manual adjust (non-zero + note ≥3) |
| `listTransactions` | Transaction ledger |

## orderController.js

| Function | Kaam |
|---|---|
| `placeOrder` | Order create (item snapshot, discount calc, loyalty redeem/earn, checkout draft) |
| `getMyOrders` | Customer orders |
| `getOrderById` | Customer order detail (ownership) |
| `editOrder` | Customer order edit |
| `deleteOrder` | Customer delete own order |
| `getAllOrders` | Admin list |
| `getProductSummary` | Product sales summary |
| `getOrderByIdAdmin` | Admin detail |
| `updateOrderStatus` | Status change (loyalty transitions) |
| `updatePaymentStatus` | Payment status |

## otpController.js
Email OTP (verification + password reset).

| Function | Kaam |
|---|---|
| `sendEmailVerificationOtp` | Verification OTP bhejo |
| `verifyEmailVerificationOtp` | Verify → `User`/seller create (PendingRegistration flow) |
| `sendVerificationOtpForEmail` | Email par OTP |
| `sendForgotPasswordOtp` | Reset OTP |
| `verifyForgotPasswordOtp` | Reset OTP verify → short-lived reset token |
| `resetPasswordWithOtp` | Password reset (token + OTP check, sessions revoke) |
| `getEmailHealth` | SMTP diagnostics |

Constants: `OTP_EXPIRE_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_SECONDS`.

## posController.js

| Function | Kaam |
|---|---|
| `getPosProducts` | POS catalog |
| `getPosSales` | Sales list |
| `getPosReturns` | Returns list |
| `getPosSaleById` | Sale detail |
| `getCustomerPosHistory` | Customer POS history + total spent |
| `createPosSale` | Sale create (stock check, atomic decrement, rollback, payment rules) |
| `updatePosSale` | Edit (edit_history, stock adjust) |
| `returnPosSaleItems` | Return (per-variant cap, tax-inclusive refund, restock) |

## productController.js

| Function | Kaam |
|---|---|
| `getProducts` | Public storefront list (facets/filter/sort/pagination) |
| `getProductStats` | Stat cards |
| `getProductFacets` | Shop facets (30s cache) |
| `getCategoryTiles` | Category tiles (60s cache) |
| `getProductDocumentHistory` | Product doc history |
| `getProductById` | Detail |
| `createProduct` | Create (name/category/brand required; perishable validation) |
| `updateProduct` | Update |
| `deleteProduct` | Soft delete product + variants |
| `toggleProductStatus` | Active toggle |
| `bulkProductFeatured` | Bulk featured |
| `toggleProductFeatured` | Single featured toggle |

## purchaseOrderController.js

| Function | Kaam |
|---|---|
| `getNextPONumber` | Next `PO-00001` |
| `createPO` | Create (items validate, cost ≤ sell, totals) |
| `getAllPOs` | List |
| `getPOByIdAdmin` | Detail |
| `updatePO` | Update |
| `confirmPO` / `cancelPO` / `closePO` | Transitions |
| `deliverPO` / `receivePO` | Stock in + `StockHistory` + socket |
| `recordPOPayment` | Paid/due update |

Internal: `buildItems`, `generateNextPONumber`, `transition`, `supportsTx`.

## quoteController.js

| Function | Kaam |
|---|---|
| `listQuotes` | List |
| `reserveQuoteNumber` | 24h number reservation token |
| `createQuote` | Create (server-side recompute totals) |
| `getQuote` | Detail |
| `updateQuote` | Update (sirf Pending/Draft) |
| `updateQuoteStatus` | Status (Sent/Accepted/Rejected) |

## referralController.js

| Function | Kaam |
|---|---|
| `getMine` | Customer referral summary + share link |
| `getAdmin` | Admin referral program |
| `saveAdmin` | Save referral program |

## reviewController.js

| Function | Kaam |
|---|---|
| `getAdminReviews` | Admin list + stats |
| `getAdminReviewById` | Admin detail |
| `getProductReviews` | Public reviews + summary |
| `getMyReviews` | Customer reviews |
| `createReview` | Create (delivered purchase required, media) |
| `updateReview` | Own review edit |
| `deleteReview` | Own/staff delete (media cleanup) |
| `setReviewStatus` | Hide/unhide |
| `setReviewResponse` | Admin response |
| `deleteReviewResponse` | Response remove |

## sellerApplicationController.js

| Function | Kaam |
|---|---|
| `sellerApply` | Application submit |
| `sellerApplyStatus` | Status by email |
| `sellerSetupState` | Setup state by signed token |
| `completeSetup` | Store details + documents (token required) |
| `sellerStatusMe` | Signed-in applicant status |
| `sellerDashboard` | Approved seller dashboard |
| `sellerStore` | Approved seller store |
| `sellerStoreUpdate` | Store update (whitelisted) |

## shippingController.js

| Function | Kaam |
|---|---|
| `getShippingConfig` / `updateShippingConfig` | Config (standard/express/free threshold) |
| `getShippingRules` / `createShippingRule` / `updateShippingRule` / `deleteShippingRule` / `toggleShippingRule` | Rules CRUD |
| `getShippingMethods` / `createShippingMethod` / `updateShippingMethod` / `deleteShippingMethod` / `toggleShippingMethod` | Methods CRUD |
| `getActiveShippingRules` / `getActiveShippingMethods` | Public active |
| `calculateShipping` | Fee logic (methods/rules/free threshold) |
| `quoteShipping` | `POST /shipping/quote` |

## stockController.js

| Function | Kaam |
|---|---|
| `getStockOverview` | Stock list (filter out/low) |
| `adjustStock` | Adjust + `StockHistory` |
| `getStockHistory` | History |

## storeController.js

| Function | Kaam |
|---|---|
| `getStoreInfo` | Admin store info |
| `updateStoreInfo` | Update + logo (tenantMulter) |
| `getPublicStoreInfo` | Public store info (60s cache) |
| `resolveTenant` | Host → store (`/store/resolve`) |
| `checkSubdomain` | Subdomain availability |
| `updateStoreDomain` | Custom domain set |

## superAdminController.js
Platform admin — bohat saare functions. Groups:

| Group | Functions |
|---|---|
| Auth | `loginSuperAdmin`, `refreshSuperAdminToken`, `logoutSuperAdmin`, `meSuperAdmin` |
| Dashboard | `getDashboard`, `myActivity` |
| Requests | `listRequests`, `getRequest`, `updateRequest`, `deleteRequest`, `approveRequest`, `rejectRequest`, `requestInfo` |
| Stores | `listStores`, `getStore`, `createStore`, `createSellerStore`, `updateStore`, `deleteStore`, `setStoreStatus`, `openStoreAdmin` |
| Store admins | `listStoreAdmins`, `getStoreAdmin`, `updateStoreAdmin`, `resetStoreAdminPassword`, `setStoreAdminStatus` |
| Users | `listUsers`, `getUser`, `updateUser`, `deleteUser`, `setUserPassword`, `setUserStatus` |
| Team | `listTeam`, `createTeamMember`, `getTeamMember`, `teamMemberActivity`, `updateTeamMember`, `setTeamMemberStatus`, `resetTeamMemberPassword`, `deleteTeamMember` |
| Plans | `listPlans`, `createPlan`, `getPlan`, `updatePlan`, `setPlanStatus`, `deletePlan`, `planActivity` |

Key logic: `approveRequest` atomic; `createSellerStore` store+owner+application with rollback;
cross-store queries `skipTenantScope`; har action `SuperAdminActivity` log.

## tagController.js

| Function | Kaam |
|---|---|
| `getAllTags` | List |
| `createTag` | Create (slug) |
| `updateTag` | Update |
| `deleteTag` | Soft delete |

## translationController.js

| Function | Kaam |
|---|---|
| `translatePage` | On-demand translation sync (model whitelist, ≤50 ids, 1 locale) |

## userController.js
Auth + profile + drafts + wishlist + handoff.

| Group | Functions |
|---|---|
| Signup/login | `createUser`, `checkRegistration`, `loginUser`, `loginAdmin`, `logoutUser` |
| Refresh | `refreshAccessToken`, `refreshAdminAccessToken` |
| Google | `googleLogin`, `googleCustomerLogin` |
| Handoff | `createStoreHandoff`, `exchangeStoreHandoff` |
| Profile | `getMe`, `getProfile`, `getProfileInfo`, `updateProfile`, `updateProfileInfo`, `updateProfileREST`, `updatePhone` |
| Password | `changePassword`, `changePasswordREST`, `changePasswordSocket` |
| Checkout drafts | `createCheckoutDraft`, `getCheckoutDrafts`, `getCheckoutDraft`, `updateCheckoutDraft`, `deleteCheckoutDraft` |
| Wishlist | `getWishlist`, `toggleWishlist` |

⚠️ Known bug: `createUser` me `return res.send(referralCode)` (line ~168) — dekho
[10-notes-and-issues.md](10-notes-and-issues.md).

## variantController.js

| Function | Kaam |
|---|---|
| `createVariant` | Create (images, tags find-or-create/restore) |
| `getNextSkuNumber` | Next SKU |
| `updateVariant` | Update |
| `deleteVariant` | Soft delete |
| `getVariants` | List |
| `getVariantById` | Detail |

## vendorController.js

| Function | Kaam |
|---|---|
| `getNextVendorCode` | Next `VEN-...` |
| `createVendor` | Create |
| `getVendorsAdmin` | List |
| `getVendorById` | Detail |
| `getVendorWithPOs` | Vendor + purchase orders |
| `updateVendor` | Update |
| `deleteVendor` | Soft delete |
| `restoreVendor` | Restore |
