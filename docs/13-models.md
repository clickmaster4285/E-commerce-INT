# 13 — Models Reference (schema by schema)

`backend/models/` — 47 Mongoose models. Store-owned models pe `utils/tenantScopePlugin.js` lagta hai
(automatic `storeId` filter on queries + stamp on writes). Cross-store query ke liye
`.setOptions({ skipTenantScope: true })`.

Tenant-scope status:
- **Scoped** (41): store-owned data (Product, Order, User, Employee, etc.)
- **Unscoped** (6): `Address`, `PendingRegistration`, `Plan`, `SellerApplication`, `SuperAdmin`, `SuperAdminActivity`
- **Special**: `Store` scopes on its own `_id` (`{field:"_id", stamp:false}`); `RefreshSession` scoped (storeId field present).

---

## Address.js — `Address`
Customer address book entry.
Fields: `user_id`, `country`, `full_name`, `street_address1`, `street_address2`, `city`, `state`, `zip_code`, `phone`, `delivery_instructions`, `is_default`, `_id`, `created_at`, `updated_at`.
Scope: **unscoped** (linked via `user_id`).

## Attribute.js — `Attribute`
Per-store product attribute (Color, RAM, Size…).
Fields: `name`, `code`, `category`, `data_type`, `unit`, `values`, `variant_allowed`, `is_active`, `is_deleted`, `createdby`, `updatedby`, `_id`, `created_at`, `updated_at`, `storeId`.
Helpers: `normalizeValues`, `sanitizePayload` (controller).

## Banner.js — `Banner`
Storefront banner.
Fields: `title`, `bannerType`, `status`, `position`, `desktopImage`, `eyebrow`, `heading`, `description`, `primaryButton`, `startDate`, `endDate`, `storeId`, `createdby`, `updatedby`, `_id`, `createdAt`, `updatedAt`.
Helpers: `ensurePositionUnique` (middleware).

## brand.js — `Brand`
Brand.
Fields: `brand_code`, `name`, `description`, `country`, `is_active`, `is_deleted`, `deleted_at`, `createdby`, `updatedby`, `deletedby`, `_id`, `created_at`, `updated_at`, `storeId`.

## Bundle.js — `Bundle`
Combo bundle.
Fields: `name`, `description`, `products`, `image`, `bundlePrice`, `isActive`, `createdby`, `updatedby`, `_id`, `createdAt`, `updatedAt`, `storeId`.
Helpers: `attachPricing` (controller).

## Cart.js — `Cart`
Per-user cart (one doc per user).
Fields: `user_id`, `items`, `_id`, `created_at`, `updated_at`, `storeId`.

## Category.js — `Category`
Hierarchical category.
Fields: `tenant_id`, `category_code`, `name`, `description`, `parent_category_id`, `attributes`, `is_active`, `is_deleted`, `deleted_at`, `createdby`, `updatedby`, `deletedby`, `_id`, `created_at`, `updated_at`, `storeId`.
Helpers: `ensureUniqueCategoryCode`, `getCategoryTree` (controller).

## ChatConversation.js — `ChatConversation`
Support chat conversation.
Fields: `customer_id`, `order_id`, `inquiry_type`, `inquiry_context`, `inquiry_product_id`, `inquiry_variant_id`, `guest_name`, `guest_email`, `guest_token_hash`, `status`, `last_message`, `last_message_at`, `last_message_sender_type`, `unread_admin_count`, `unread_customer_count`, `_id`, `created_at`, `updated_at`, `storeId`.

## ChatMessage.js — `ChatMessage`
Chat message.
Fields: `conversation_id`, `sender_id`, `sender_type`, `sender_name`, `text`, `context_snapshot`, `read_at`, `_id`, `created_at`, `storeId`.

## CheckoutDraft.js — `CheckoutDraft`
Saved checkout draft.
Fields: `user_id`, `drafts`, `_id`, `created_at`, `updated_at`, `storeId`.

## Customer.js — `Customer`
Offline/POS customer directory (storefront `User` se alag).
Fields: `name`, `phone`, `email`, `address`, `notes`, `is_deleted`, `createdby`, `updatedby`, `deletedby`, `activity`, `_id`, `created_at`, `updated_at`, `storeId`.
Helpers: `syncLeadCustomer` (controller).

## Deal.js — `Deal`
Automatic promotion.
Fields: `name`, `description`, `type`, `applyTo`, `productIds`, `categoryIds`, `brandIds`, `discountValue`, `buyQuantity`, `getQuantity`, `getDiscountValue`, `bundleProducts`, `bundlePrice`, `image`, `startDate`, `endDate`, `minQuantity`, `usageLimit`, `usedCount`, `perUserLimit`, `customerType`, `isActive`, `isFeatured`, `createdBy`, `updatedBy`, `_id`, `createdAt`, `updatedAt`, `storeId`.

## Discount.js — `Discount`
Coupon/promo code.
Fields: `code`, `name`, `description`, `type`, `value`, `applyTo`, `selectedProducts`, `selectedCategories`, `selectedBrands`, `selectedTags`, `selectedSizes`, `minOrderValue`, `minQuantity`, `startDate`, `endDate`, `usageLimit`, `perUserLimit`, `isStackable`, `status`, `isActive`, `is_deleted`, `createdBy`, `updatedBy`, `_id`, `createdAt`, `updatedAt`, `storeId`.

## Employee.js — `Employee`
Store staff account.
Fields: `name`, `username`, `email`, `password`, `phone`, `role`, `seller_pending`, `status`, `avatar`, `storeId`, `address`, `employeeCode`, `department`, `ordersHandled`, `salesGenerated`, `productsAdded`, `performanceRating`, `activities`, `createdby`, `updatedby`, `is_deleted`, `deleted_at`, `_id`, `created_at`, `updated_at`.
Helpers: `migratePermissions` (controller on read).

## Invoice.js — `Invoice`
Invoice + payments + returns.
Fields: `invoice_number`, `customer_id`, `customer_name`, `customer_email`, `customer_phone`, `customer_address`, `invoice_date`, `due_date`, `payment_terms`, `items`, `subtotal`, `discount`, `tax`, `original_total`, `total`, `bank_details`, `terms`, `pdf_design`, `amount_paid`, `remaining_balance`, `payments`, `returns`, `activity`, `status`, `sent_at`, `paid_at`, `createdby`, `updatedby`, `is_deleted`, `_id`, `created_at`, `updated_at`, `storeId`.
Helpers: `getNextInvoiceNumber` (controller).

## Lead.js — `Lead`
CRM lead.
Fields: `lead_number`, `lead_type`, `name`, `phone`, `email`, `company_name`, `business_type`, `business_address`, `city`, `source`, `status`, `customer_added`, `customer_id`, `product_interest`, `category_id`, `assigned_employee_id`, `estimated_deal_value`, `expected_purchase_date`, `next_follow_up_date`, `lost_reason`, `products`, `custom_requirements`, `notes`, `activities`, `history`, `createdby`, `updatedby`, `is_deleted`, `deleted_at`, `_id`, `created_at`, `updated_at`, `storeId`.

## LoyaltyAccount.js — `LoyaltyAccount`
Customer loyalty balance.
Fields: `user_id`, `balance`, `pending`, `lifetimeEarned`, `lifetimeRedeemed`, `_id`, `created_at`, `updated_at`, `storeId`.

## LoyaltyNotice.js — `LoyaltyNotice`
Point earned/refunded notice.
Fields: `user_id`, `kind`, `points`, `refunded`, `reversed`, `order_id`, `order_number`, `note`, `balance_after`, `seen_at`, `_id`, `created_at`, `storeId`.

## LoyaltySettings.js — `LoyaltySettings`
Program settings (one per store).
Fields: `enabled`, `programName`, `updatedby`, `_id`, `created_at`, `updated_at`, `storeId`.

## LoyaltyTransaction.js — `LoyaltyTransaction`
Ledger entry.
Fields: `user_id`, `type`, `points`, `reversed_points`, `status`, `source_key`, `order_id`, `order_number`, `note`, `claimed_at`, `actor_id`, `actor_name`, `_id`, `created_at`, `updated_at`, `storeId`.

## Order.js — `Order`
Customer order.
Fields: `order_number`, `user_id`, `checkout_draft_id`, `items`, `address_id`, `shipping_method`, `subtotal`, `shipping`, `tax`, `loyalty_points_redeemed`, `loyalty_discount`, `loyalty_points_earned`, `total`, `status`, `notes`, `cancel_reason`, `deal_ids`, `total_deal_savings`, `bundle_ids`, `total_bundle_savings`, `_id`, `created_at`, `updated_at`, `storeId`.

## Otp.js — `Otp`
Email OTP (verification + password reset).
Fields: `email`, `purpose`, `code_hash`, `expires_at`, `attempts`, `verified`, `consumed`, `created_at`, `_id`, `storeId`.
Helpers: constants in controller (`OTP_EXPIRE_MINUTES`, etc.).

## PendingRegistration.js — `PendingRegistration`
Seller signup OTP flow state.
Fields: `email`, `name`, `username`, `phone`, `storeId`, `referralCode`, `storeName`, `subdomain`, `storeDescription`, `businessCategory`, `businessType`, `country`, `city`, `address`, `zipCode`, `storeLogoUrl`, `passwordHash`, `otpHash`, `expiresAt`, `attempts`, `lastSentAt`, `_id`, `created_at`, `updated_at`.
Scope: **unscoped** (no store yet).

## Plan.js — `Plan`
Super-admin subscription plan.
Fields: `name`, `slug`, `description`, `status`, `sortOrder`, `price`, `billingInterval`, `currency`, `createdBy`, `_id`, `created_at`, `updated_at`.
Scope: **unscoped** (platform-level).

## PosSale.js — `PosSale`
POS sale.
Fields: `sale_number`, `customer_id`, `cashier_id`, `cashier_name`, `created_by_id`, `created_by_name`, `edit_history`, `items`, `subtotal`, `discount_amount`, `tax_amount`, `additional_tax_rate`, `total`, `status`, `returns`, `_id`, `created_at`, `updated_at`, `storeId`.

## Product.js — `Product`
Product master.
Fields: `name`, `category_id`, `brand_id`, `has_variants`, `tag_ids`, `description`, `tax`, `isPerishable`, `expiryDuration`, `expiryUnit`, `specifications`, `status`, `is_featured`, `featured_at`, `createdby`, `updatedby`, `deletedby`, `is_deleted`, `deleted_at`, `_id`, `created_at`, `updated_at`, `storeId`.

## PurchaseOrder.js — `PurchaseOrder`
Purchase order.
Fields: `po_number`, `vendor_id`, `items`, `subtotal`, `tax`, `overall_tax`, `overall_tax_rate`, `shipping`, `discount`, `total`, `status`, `payment_status`, `paid_amount`, `due_amount`, `expected_date`, `due_date`, `notes`, `cancel_reason`, `receivings`, `is_deleted`, `deleted_at`, `createdby`, `updatedby`, `activity`, `_id`, `created_at`, `updated_at`, `storeId`.

## PurchasePayment.js — `PurchasePayment`
PO payment record.
Fields: `po_id`, `vendor_id`, `amount`, `method`, `paid_at`, `createdby`, `_id`, `created_at`, `updated_at`, `storeId`.

## Quote.js — `Quote`
Quote document.
Fields: `quote_number`, `customer_type`, `customer_id`, `lead_id`, `customer_name`, `customer_email`, `customer_phone`, `customer_address`, `quote_date`, `expiry_date`, `items`, `subtotal`, `overall_discount_rate`, `overall_discount`, `tax_rate`, `tax`, `discount`, `total`, `terms`, `notes`, `pdf_design`, `status`, `createdby`, `updatedby`, `activity`, `is_deleted`, `_id`, `created_at`, `updated_at`, `storeId`.

## Referral.js — `Referral`
Referral record.
Fields: `referrerId`, `referredUserId`, `referralCode`, `referrerPoints`, `friendPoints`, `status`, `_id`, `created_at`, `updated_at`, `storeId`.

## ReferralProgram.js — `ReferralProgram`
Referral program settings.
Fields: `enabled`, `referrerPoints`, `friendPoints`, `saleReferrerPoints`, `headline`, `_id`, `created_at`, `updated_at`, `storeId`.

## RefreshSession.js — `RefreshSession`
Refresh token session (cross-store, storeId optional).
Fields: `jti`, `familyId`, `aud`, `subjectId`, `storeId`, `tokenHash`, `expiresAt`, `revokedAt`, `revokedReason`, `replacedBy`, `userAgent`, `ip`, `_id`, `createdAt`, `updatedAt`.

## Review.js — `Review`
Product review.
Fields: `product_id`, `user_id`, `rating`, `title`, `comment`, `images`, `videos`, `verifiedPurchase`, `status`, `is_deleted`, `deleted_at`, `_id`, `created_at`, `updated_at`, `storeId`.

## SellerApplication.js — `SellerApplication`
Seller application (platform-level).
Fields: `name`, `email`, `phone`, `username`, `passwordHash`, `store_name`, `store_description`, `business_category`, `business_type`, `country`, `city`, `address`, `zip_code`, `documents`, `setup_completed`, `info_request_message`, `info_requested_at`, `status`, `rejection_reason`, `reviewed_by`, `reviewed_at`, `store_id`, `user_id`, `_id`, `created_at`, `updated_at`.
Scope: **unscoped**.

## ShippingConfig.js — `ShippingConfig`
Shipping config (one per store).
Fields: `free_shipping_over`, `_id`, `createdAt`, `updatedAt`, `storeId`.

## ShippingMethod.js — `ShippingMethod`
Shipping method.
Fields: `name`, `code`, `fee`, `min_days`, `max_days`, `is_active`, `_id`, `createdAt`, `updatedAt`, `storeId`.

## ShippingRule.js — `ShippingRule`
Shipping rule.
Fields: `rule_type`, `ref_id`, `shipping_type`, `fee`, `is_active`, `note`, `_id`, `createdAt`, `updatedAt`, `storeId`.

## StockHistory.js — `StockHistory`
Stock movement log.
Fields: `variant_id`, `product_id`, `product_name`, `sku`, `variant_title`, `previous_quantity`, `new_quantity`, `change_quantity`, `adjustment_type`, `reason`, `explanation`, `performed_by`, `performed_by_name`, `_id`, `created_at`, `updated_at`, `storeId`.

## Store.js — `Store`
Store (tenant root). Scopes on its own `_id`.
Fields: `store_name`, `tagline`, `subdomain`, `customDomain`, `domainVerified`, `domainVerifyToken`, `email`, `phone`, `support_email`, `support_phone`, `country`, `state`, `city`, `zip_code`, `address`, `description`, `business_category`, `business_type`, `currency`, `tax_rate`, `weight_unit`, `store_status`, `maintenance_message`, `planId`, `meta_title`, `meta_description`, `meta_keywords`, `return_policy`, `privacy_policy`, `terms_conditions`, `quote_terms_conditions`, `invoice_terms_conditions`, `quote_terms_translations`, `invoice_terms_translations`, `activity`, `_id`, `createdAt`, `updatedAt`.

## SuperAdmin.js — `SuperAdmin`
Platform super admin.
Fields: `name`, `email`, `passwordHash`, `role`, `status`, `phone`, `createdBy`, `lastLoginAt`, `lastActiveAt`, `activities`, `_id`, `created_at`, `updated_at`.
Scope: **unscoped**.

## SuperAdminActivity.js — `SuperAdminActivity`
Super admin action audit.
Fields: `action`, `entityType`, `entityId`, `details`, `_id`, `created_at`.
Scope: **unscoped**.

## Tag.js — `Tag`
Product tag.
Fields: `name`, `slug`, `createdby`, `updatedby`, `is_deleted`, `_id`, `createdAt`, `updatedAt`, `storeId`.

## UsedToken.js — `UsedToken`
One-time token replay protection.
Fields: `_id`, `expiresAt`.
Scope: scoped (storeId auto-stamped on writes).

## User.js — `User`
Storefront customer.
Fields: `name`, `username`, `email`, `password`, `emailVerified`, `google_id`, `provider`, `phone`, `status`, `role`, `referralCode`, `referredByCode`, `avatar`, `dob`, `storeId`, `updatedby`, `deletedby`, `is_deleted`, `deleted_at`, `_id`, `created_at`, `updated_at`.

## Variant.js — `Variant`
Product variant (SKU).
Fields: `product_id`, `sku`, `title`, `description`, `cost_price`, `selling_price`, `expiry_after_delivery`, `expiry_after_delivery_unit`, `quantity`, `min_qnt`, `max_qnt`, `topup`, `attributes`, `status`, `tags`, `images`, `createdby`, `updatedby`, `deletedby`, `_id`, `created_at`, `updated_at`, `storeId`.

## Vendor.js — `Vendor`
Vendor/supplier.
Fields: `vendor_code`, `name`, `company_name`, `contact_person`, `email`, `phone`, `whatsapp`, `address`, `city`, `state`, `country`, `zip_code`, `tax_id`, `lead_time_days`, `rating`, `is_active`, `balance_payable`, `total_purchased`, `total_paid`, `is_deleted`, `deleted_at`, `createdby`, `updatedby`, `deletedby`, `activity`, `_id`, `created_at`, `updated_at`, `storeId`.

## Wishlist.js — `Wishlist`
Customer wishlist.
Fields: `user_id`, `products`, `_id`, `created_at`, `updated_at`, `storeId`.

---

## Cross-cutting model notes
- Timestamps: kuch models `createdAt/updatedAt` (camelCase), kuch `created_at/updated_at` (snake_case) — don't assume.
- Soft delete: `is_deleted`, `deleted_at`, `deletedby` pattern (Category, Product, Vendor, Customer, Tag, etc.).
- Audit: `createdby`, `updatedby` fields (string/ObjectId mix).
- Unique indexes compound with `storeId` (e.g. `{storeId, sku}`, `{storeId, email}`).
- `utils/tenantMulter` uploads for store-scoped files; `localPathForUrl` refuses other stores' files.
- `translations.<field>.<locale>` + `translation_source.<field>` md5 hash on translatable models (Product, Category, Brand, Deal, Discount, Banner, Attribute, Review).
