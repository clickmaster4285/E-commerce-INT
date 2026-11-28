# 06 — Data Models (Mongoose)

`backend/models/` me 47 models hain. Har model par timestamps, soft-delete (`is_deleted`,
`deleted_at`, `deletedby`) aur (mostly) `tenantScope` plugin lagta hai.

> `tenantScope` = store context me automatically `storeId` filter/stamp. Jo models
> **tenant-scoped nahi** hain unhe niche alag se mark kiya gaya hai.

## 1. Platform / multi-tenancy

| Model | File | Kaam | Notable |
|---|---|---|---|
| `Store` | Store.js | Ek storefront ka record (branding, domains, business, plan) | `subdomain`/`customDomain` partial-unique; `plugin(tenantScope,{field:"_id",stamp:false})`; auto subdomain; naye store par attributes seed |
| `Plan` | Plan.js | Subscription plans + limits/features | unique name/slug; `limits{maxProducts,maxStaffAccounts,…}`; **not tenant-scoped** |

## 2. Auth & accounts

| Model | File | Kaam | Notable |
|---|---|---|---|
| `User` | User.js | Storefront customer | unique `{storeId,username}`, `{storeId,email}`, `{storeId,referralCode}`; collection `customer_users` |
| `Employee` | Employee.js | Store admin panel account (owner/admin/manager/staff) | permissions map; `seller_pending`; collection `admin_users` |
| `SuperAdmin` | SuperAdmin.js | Platform admin/staff | collection `superadmin_users`; **not tenant-scoped** |
| `SuperAdminActivity` | SuperAdminActivity.js | Platform audit trail | **not tenant-scoped** |
| `RefreshSession` | RefreshSession.js | Refresh token rotation/family | `jti` unique; TTL; **not tenant-scoped** (deliberate) |
| `UsedToken` | UsedToken.js | One-time token ledger (handoff fallback) | string `_id`; TTL; **not tenant-scoped** |
| `Otp` | Otp.js | Hashed OTPs (verify/reset) | TTL expiry |
| `PendingRegistration` | PendingRegistration.js | OTP verify se pehle ka signup data | email unique; **not tenant-scoped** |
| `SellerApplication` | SellerApplication.js | Seller signup queue | email unique; **not tenant-scoped** |

## 3. Catalog

| Model | File | Kaam | Notable |
|---|---|---|---|
| `Product` | Product.js | Product master | variants hold SKU/price/stock; translations; soft-delete |
| `Variant` | Variant.js | Sellable SKU | unique `{storeId,sku}`; stock, prices, attributes, images |
| `Category` | Category.js | Hierarchical category | unique `{storeId,category_code,is_deleted}`; embedded attributes config |
| `Brand` | brand.js | Brand + logo | unique `{storeId,brand_code,is_deleted}`; softDelete/restore |
| `Attribute` | Attribute.js | Per-store attribute definitions | unique `{storeId,code,is_deleted}`; values with translations |
| `Tag` | Tag.js | Product tags | unique `{storeId,name}`, `{storeId,slug}` |
| `Banner` | Banner.js | Storefront banners | position unique; scheduled/active; translations |
| `Bundle` | Bundle.js | Combo deal (≥2 products) | `bundlePrice`, image required |

## 4. Promotions

| Model | File | Kaam | Notable |
|---|---|---|---|
| `Deal` | Deal.js | Automatic promotions | types: percentage/fixed_amount/buy_x_get_y/bundle/free_shipping; schedule |
| `Discount` | Discount.js | Coupon/promo codes | unique `{storeId,code}`; targeting + limits; deal priority |
| `Review` | Review.js | Product reviews | unique `{product_id,user_id}`; delivered purchase required; media; store response |

## 5. Cart, checkout, orders

| Model | File | Kaam | Notable |
|---|---|---|---|
| `Address` | Address.js | Customer address book | **not tenant-scoped** (sirf user_id) |
| `Cart` | Cart.js | Persistent cart (per user per store) | unique `{storeId,user_id}`; items Mixed |
| `CheckoutDraft` | CheckoutDraft.js | Resumable checkout state | unique `{storeId,user_id}` |
| `Wishlist` | Wishlist.js | Wishlist product refs | one doc per user (index se enforce nahi) |
| `Order` | Order.js | Order + item/address snapshots | unique `{storeId,order_number}`; loyalty, deal/bundle fields |

## 6. Inventory & purchasing

| Model | File | Kaam |
|---|---|---|
| `StockHistory` | StockHistory.js | Stock adjustment audit trail |
| `Vendor` | Vendor.js | Supplier directory + balances |
| `PurchaseOrder` | PurchaseOrder.js | PO to vendor (items, receivings, payment) |
| `PurchasePayment` | PurchasePayment.js | Payment against a PO |

## 7. Shipping

| Model | File | Kaam | Notable |
|---|---|---|---|
| `ShippingConfig` | ShippingConfig.js | Per-store defaults | singleton (`getConfig`) |
| `ShippingMethod` | ShippingMethod.js | Custom methods | unique `{storeId,code}` |
| `ShippingRule` | ShippingRule.js | Rule-based overrides (free/fixed) | by product/category/brand/all |

## 8. POS & finance

| Model | File | Kaam | Notable |
|---|---|---|---|
| `PosSale` | PosSale.js | POS sale + returns + edit history | unique `{storeId,sale_number}` |
| `Invoice` | Invoice.js | Customer invoice + payments/returns | unique `{storeId,invoice_number}` |
| `Quote` | Quote.js | Sales quotation | unique `{storeId,quote_number}`; `Quote.NumberReservation` sub-model |
| `Customer` | Customer.js | Offline/POS customer directory | separate from storefront `User` |
| `Lead` | Lead.js | CRM lead pipeline | unique `{storeId,lead_number}` (partial) |

## 9. Loyalty & referrals

| Model | File | Kaam | Notable |
|---|---|---|---|
| `LoyaltySettings` | LoyaltySettings.js | Per-store program config | unique `{storeId}` |
| `LoyaltyAccount` | LoyaltyAccount.js | Points balance snapshot | unique `{storeId,user_id}` |
| `LoyaltyTransaction` | LoyaltyTransaction.js | Immutable points ledger | unique `{storeId,source_key}` (idempotency) |
| `LoyaltyNotice` | LoyaltyNotice.js | Customer point notifications | kinds gift/deduct/cancel/restore |
| `ReferralProgram` | ReferralProgram.js | Per-store referral config | unique `{storeId}` |
| `Referral` | Referral.js | Referral relationship + reward | unique `{storeId,referredUserId}` |

## 10. Chat

| Model | File | Kaam | Notable |
|---|---|---|---|
| `ChatConversation` | ChatConversation.js | Customer↔admin thread | partial unique open conversation; guest token hash; `ensureChatIndexes()` |
| `ChatMessage` | ChatMessage.js | Individual message | context snapshot; read_at |

## 11. Tenant-scope status

**Tenant-scoped (39):** Store (special), User, Employee, Otp, Product, Variant, Category, Brand,
Attribute, Tag, Banner, Bundle, Deal, Discount, Review, Cart, CheckoutDraft, Wishlist, Order,
StockHistory, Vendor, PurchaseOrder, PurchasePayment, ShippingConfig, ShippingMethod,
ShippingRule, PosSale, Invoice, Quote, Customer, Lead, LoyaltySettings, LoyaltyAccount,
LoyaltyTransaction, LoyaltyNotice, ReferralProgram, Referral, ChatConversation, ChatMessage.

**Not tenant-scoped (8):** Address (sirf user_id), PendingRegistration, SellerApplication, Plan,
SuperAdmin, SuperAdminActivity, UsedToken, RefreshSession (deliberate reasons).

## 12. Model helpers (hooks/statics/methods)

| Model | Helper |
|---|---|
| Store | `generateUniqueSubdomain`, pre validate/save, post save (attributes seed) |
| Brand / Vendor | `findActive`, `softDelete`, `restore` |
| User | `softDelete` |
| ShippingConfig | `getConfig` |
| Plan | `slugify`, `uniqueSlug`, constants |
| ChatConversation | `ensureChatIndexes` |
| Quote | `Quote.NumberReservation` |
| LoyaltyTransaction / LoyaltyNotice | constants (`TYPES`, `STATUSES`, `KINDS`) |
