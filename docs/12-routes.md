# 12 — Routes Reference (endpoint by endpoint)

Backend mount: `server.js` line 240-274. Har router `API_PREFIX` (`/api` dev me) ke under mount hota hai.
Example: `GET /api/products`, `POST /api/users/login`.

Middleware legend:
- `auth` = `authMiddleware` (Bearer ya `accessToken` cookie; accepts `user`/`employee`)
- `authU` = `authMiddleware.requireUser` (customer only)
- `authA` = `authMiddleware.requireAdmin` (employee/admin only)
- `perm(x)` = `checkPermission(x)` (admin always allowed; others blocked only when `permissions[x] === false`)
- `staff` = `staffPermissionCheck`
- `sa` = `requireSuperAdmin`
- `approved` = `requireApprovedSeller`
- `RL` = rate limiter
- `dropX` = cache invalidate middleware

---

## addressRoutes — `/addresses`
| Method | Path | Handler | MW |
|---|---|---|---|
| GET | `/` | getMyAddresses | authU |
| POST | `/` | createAddress | authU |
| PUT | `/:id/default` | setDefaultAddress | authU |
| PUT | `/:id` | updateAddress | authU |
| DELETE | `/:id` | deleteAddress | authU |

## attributeRoutes — `/attributes`
| GET | `/` | getAttributes | authA, perm(attribute) |
| GET | `/stats` | getAttributeStats | authA, perm(attribute) |
| POST | `/` | createAttribute | authA, perm(attribute) |
| GET | `/:id/categories` | getAttributeCategories | authA, perm(attribute) |
| PUT | `/:id/categories` | updateAttributeCategories | authA, perm(attribute) |
| GET | `/:id` | getAttributeById | authA, perm(attribute) |
| PUT | `/:id` | updateAttribute | authA, perm(attribute) |
| DELETE | `/:id` | deleteAttribute | authA, perm(attribute) |

## bannerRoutes — `/banners`
| GET | `/admin/all` | getAllBanners | authA, perm(banners) |
| GET | `/` | getAllBanners | authA, perm(banners) |
| GET | `/active` | getActiveBanners | (public) |
| GET | `/:id` | getBanner | authA, perm(banners) |
| POST | `/` | createBanner | authA, perm(banners), dropBannersCache, upload |
| PUT | `/:id` | updateBanner | authA, perm(banners), dropBannersCache, upload |
| PATCH | `/:id/toggle` | toggleStatus | authA, perm(banners), dropBannersCache |
| POST | `/:id/duplicate` | duplicateBanner | authA, perm(banners), dropBannersCache |
| DELETE | `/:id` | deleteBanner | authA, perm(banners), dropBannersCache |

## brandRoutes — `/brands`
| GET | `/` | getBrandsPublic | (public, 60s cache) |
| GET | `/next-code` | getNextBrandCode | authA, perm(brands) |
| GET | `/:id/details` | getBrandWithProducts | (public) |
| GET | `/:id` | getBrandById | (public) |
| GET | `/admin/all` | getBrandsAdmin | authA, perm(brands) |
| POST | `/` | createBrand | authA, perm(brands) |
| PUT | `/:id` | updateBrand | authA, perm(brands) |
| DELETE | `/:id` | deleteBrand | authA, perm(brands) |

## bundleRoutes — `/bundles`
| GET | `/active` | getActiveBundles | (public) |
| GET | `/` | getBundles | authA, perm(bundles) |
| GET | `/:id` | getBundleById | authA, perm(bundles) |
| POST | `/` | createBundle | authA, perm(bundles), upload |
| PUT | `/:id` | updateBundle | authA, perm(bundles), upload |
| DELETE | `/:id` | deleteBundle | authA, perm(bundles) |
| PATCH | `/:id/toggle-status` | toggleBundleStatus | authA, perm(bundles) |

## cartRoutes — `/cart`
| GET | `/` | getCart | authU |
| PUT | `/` | saveCart | authU |

## categoryRoutes — `/categories`
| GET | `/public` | inline (public list) | (public) |
| GET | `/admin/options` | inline (options) | authA |
| GET | `/admin/all` | inline (all) | authA |
| GET | `/next-code` | getNextCode | authA, perm(products) |
| GET | `/` | getCategories | authA, perm(products) |
| GET | `/:id` | getCategoryById | authA, perm(products) |
| GET | `/:id/attributes` | getCategoryAttributes | authA, perm(products) |
| GET | `/:id/attributes-hierarchy` | getCategoryAttributesHierarchical | authA, perm(products) |
| POST | `/` | createCategory | authA, perm(products) |
| PUT | `/:id` | updateCategory | authA, perm(products) |
| PUT | `/:id/attributes` | assignCategoryAttributes | authA, perm(products) |
| DELETE | `/:id` | deleteCategory | authA, perm(products) |

## chatRoutes — `/chats`
| POST | `/guest/start` | chat.startGuest | (public, RL) |
| GET | `/guest/mine` | chat.getGuestMine | guest token |
| GET | `/guest/:id` | chat.getConversation | guest token |
| PATCH | `/guest/:id/context` | chat.updateInquiryContext | guest token |
| GET | `/guest/:id/messages` | chat.getMessages | guest token |
| POST | `/guest/:id/messages` | chat.sendMessage | guest token, RL |
| PATCH | `/guest/:id/read` | chat.markRead | guest token |
| POST | `/general` | chat.openGeneral | authU, RL |
| POST | `/order/:orderId` | chat.openForOrder | authU, RL |
| GET | `/mine` | chat.listMine | authU |
| GET | `/admin/unread-count` | chat.unreadCount | authA, perm(order) |
| GET | `/admin/conversations` | chat.listAdmin | authA, perm(order) |
| PATCH | `/admin/:id/status` | chat.updateStatus | authA, perm(order) |
| PATCH | `/:id/context` | chat.updateInquiryContext | auth (owner/staff) |
| GET | `/:id` | chat.getConversation | auth (owner/staff) |
| GET | `/:id/messages` | chat.getMessages | auth (owner/staff) |
| POST | `/:id/messages` | chat.sendMessage | auth (owner/staff), RL |
| PATCH | `/:id/read` | chat.markRead | auth (owner/staff) |

## customerRoutes — `/customers`
| GET | `/admin/all` | getCustomersAdmin | authA, perm(customers) |
| GET | `/search` | searchCustomers | authA, perm(customers) |
| GET | `/:id` | getCustomerById | authA, perm(customers) |
| POST | `/` | createCustomer | authA, perm(customers) |
| PUT | `/:id` | updateCustomer | authA, perm(customers) |
| DELETE | `/:id` | deleteCustomer | authA, perm(customers) |

## dashboardRoutes — `/dashboard`
| GET | `/stats` | getDashboardStats | authA (range query) |

## dealRoutes — `/deals`
| GET | `/active` | getActiveDeals | (public, 30s cache) |
| GET | `/active/:id` | getActiveDealById | (public) |
| POST | `/upload-image` | uploadDealImage | authA, perm(deals), upload |
| GET | `/` | getDeals | authA, perm(deals) |
| GET | `/:id/targets` | getDealTargets | authA, perm(deals) |
| GET | `/:id` | getDealById | authA, perm(deals) |
| POST | `/` | createDeal | authA, perm(deals), dropDealsCache |
| PUT | `/:id` | updateDeal | authA, perm(deals), dropDealsCache |
| DELETE | `/:id` | deleteDeal | authA, perm(deals), dropDealsCache |
| PATCH | `/:id/toggle-status` | toggleDealStatus | authA, perm(deals), dropDealsCache |

## discountRoutes — `/discounts`
| GET | `/public` | getPublicDiscounts | (public, 60s cache) |
| POST | `/` | createDiscount | authA (no perm check?) |
| GET | `/` | getDiscounts | authA |
| GET | `/:id/targets` | getDiscountTargets | authA |
| GET | `/:id` | getDiscountById | authA |
| PUT | `/:id` | updateDiscount | authA |
| DELETE | `/:id` | deleteDiscount | authA |

> Note: discountRoutes me `checkPermission` use nahi hota (grep confirms). Sab authA par permission key nahi.

## employeeRoutes — `/employees`
| (router.use authA) |
| GET | `/` | getAllEmployees | authA, perm(employees) |
| GET | `/:id/activities` | getEmployeeActivities | authA, perm(employees) |
| GET | `/:id` | getEmployeeById | authA, perm(employees) |
| POST | `/` | createEmployee | authA, perm(employees) |
| PUT | `/:id` | updateEmployee | authA, perm(employees) |
| DELETE | `/:id` | deleteEmployee | authA, perm(employees) |
| PATCH | `/:id/toggle-status` | toggleStatus | authA, perm(employees) |

## financeRoutes — `/finance`
| GET | `/overview` | getFinanceOverview | authA |

## invoiceRoutes — `/invoices`
| GET | `/` | listInvoices | authA, staff |
| GET | `/next-number` | getNextInvoiceNumber | authA, staff |
| POST | `/` | createInvoice | authA, staff |
| PUT | `/:id` | updateInvoice | authA, staff |
| GET | `/:id` | getInvoice | authA, staff |
| POST | `/:id/send` | sendInvoice | authA, staff |
| POST | `/:id/payments` | recordPayment | authA, staff |
| POST | `/:id/returns` | recordReturn | authA, staff |

## leadRoutes — `/leads`
| GET | `/` | listLeads | authA, staff, perm(leads) |
| POST | `/` | createLead | authA, staff, perm(leads) |
| GET | `/:id` | getLead | authA, staff, perm(leads) |
| PUT | `/:id` | updateLead | authA, staff, perm(leads) |
| PATCH | `/:id/status` | updateStatus | authA, staff, perm(leads) |
| POST | `/:id/activities` | addActivity | authA, staff, perm(leads) |
| DELETE | `/:id` | deleteLead | authA, staff, perm(leads) |

## loyaltyRoutes — `/loyalty`
| GET | `/program` | getProgram | (public) |
| GET | `/me` | getMyRewards | authU |
| GET | `/me/notices` | getMyNotices | authU |
| POST | `/me/notices/seen` | markMyNoticesSeen | authU |
| POST | `/me/welcome/claim` | claimWelcomeBonus | authU |
| GET | `/referrals/me` | referrals.getMine | authU |
| GET | `/admin/overview` | getOverview | authA, perm(loyalty) |
| GET | `/admin/settings` | getSettings | authA, perm(loyalty) |
| PUT | `/admin/settings` | updateSettings | authA, perm(loyalty) |
| GET | `/admin/members` | listMembers | authA, perm(loyalty) |
| GET | `/admin/members/:userId` | getMember | authA, perm(loyalty) |
| POST | `/admin/members/:userId/adjust` | adjustMember | authA, perm(loyalty) |
| GET | `/admin/transactions` | listTransactions | authA, perm(loyalty) |
| GET | `/admin/referrals` | referrals.getAdmin | authA, perm(loyalty) |
| PUT | `/admin/referrals` | referrals.saveAdmin | authA, perm(loyalty) |

## orderRoutes — `/orders`
| POST | `/` | placeOrder | authU (RL) |
| GET | `/my` | getMyOrders | authU |
| GET | `/:id` | getOrderById | authU |
| PUT | `/:id/edit` | editOrder | authU |
| DELETE | `/:id` | deleteOrder | authU |
| GET | `/admin/all` | getAllOrders | authA, perm(order) |
| GET | `/admin/product-summary` | getProductSummary | authA, perm(order) |
| GET | `/admin/:id` | getOrderByIdAdmin | authA, perm(order) |
| PATCH | `/admin/:id/status` | updateOrderStatus | authA, perm(order) |
| PATCH | `/admin/:id/payment` | updatePaymentStatus | authA, perm(order) |

## posRoutes — `/pos`
| GET | `/products` | getPosProducts | authA, perm(pos) |
| GET | `/sales` | getPosSales | authA, perm(pos) |
| GET | `/returns` | getPosReturns | authA, perm(pos) |
| GET | `/sales/:id` | getPosSaleById | authA, perm(pos) |
| GET | `/customers/:customerId/history` | getCustomerPosHistory | authA, perm(pos) |
| POST | `/sales` | createPosSale | authA, perm(pos) |
| PUT | `/sales/:id` | updatePosSale | authA, perm(pos) |
| POST | `/sales/:id/returns` | returnPosSaleItems | authA, perm(pos) |

## productRoutes — `/products`
| GET | `/` | getProducts | (public) |
| GET | `/stats` | getProductStats | authA, perm(products) |
| GET | `/facets` | getProductFacets | (public, 30s cache) |
| GET | `/category-tiles` | getCategoryTiles | (public, 60s cache) |
| GET | `/admin/:id/history` | getProductDocumentHistory | authA, perm(products) |
| GET | `/:id` | getProductById | (public) |
| POST | `/` | createProduct | authA, perm(products), dropProductsCache, upload |
| PUT | `/:id` | updateProduct | authA, perm(products), dropProductsCache, upload |
| DELETE | `/:id` | deleteProduct | authA, perm(products), dropProductsCache |
| PATCH | `/:id/toggle-status` | toggleProductStatus | authA, perm(products), dropProductsCache |
| PATCH | `/bulk-featured` | bulkProductFeatured | authA, perm(featuredProducts) |
| PATCH | `/:id/toggle-featured` | toggleProductFeatured | authA, perm(featuredProducts) |

## purchaseOrderRoutes — `/purchase-orders`
| GET | `/next-code` | getNextPONumber | authA, perm(purchaseOrders) |
| GET | `/admin/all` | getAllPOs | authA, perm(purchaseOrders) |
| POST | `/` | createPO | authA, perm(purchaseOrders) |
| GET | `/admin/:id` | getPOByIdAdmin | authA, perm(purchaseOrders) |
| PUT | `/:id` | updatePO | authA, perm(purchaseOrders) |
| PATCH | `/admin/:id/confirm` | confirmPO | authA, perm(purchaseOrders) |
| PATCH | `/admin/:id/cancel` | cancelPO | authA, perm(purchaseOrders) |
| PATCH | `/admin/:id/close` | closePO | authA, perm(purchaseOrders) |
| POST | `/admin/:id/deliver` | deliverPO | authA, perm(purchaseOrders) |
| POST | `/admin/:id/receive` | receivePO | authA, perm(purchaseOrders) |
| PATCH | `/admin/:id/payment` | recordPOPayment | authA, perm(purchaseOrders) |

## quoteRoutes — `/quotes`
| GET | `/` | listQuotes | authA, staff, perm(quotes) |
| POST | `/reserve-number` | reserveQuoteNumber | authA, staff, perm(quotes) |
| POST | `/` | createQuote | authA, staff, perm(quotes) |
| GET | `/:id` | getQuote | authA, staff, perm(quotes) |
| PUT | `/:id` | updateQuote | authA, staff, perm(quotes) |
| PATCH | `/:id/status` | updateQuoteStatus | authA, staff, perm(quotes) |

## reviewRoutes — `/reviews`
| GET | `/admin/all` | getAdminReviews | authA, perm(reviews) |
| GET | `/admin/:id` | getAdminReviewById | authA, perm(reviews) |
| GET | `/product/:productId` | getProductReviews | (public) |
| GET | `/my` | getMyReviews | authU |
| POST | `/` | createReview | authU, RL, upload |
| PUT | `/:id` | updateReview | authU, upload |
| DELETE | `/:id` | deleteReview | authU |
| PATCH | `/:id/status` | setReviewStatus | authA, perm(reviews) |
| PATCH | `/:id/response` | setReviewResponse | authA, perm(reviews) |
| DELETE | `/:id/response` | deleteReviewResponse | authA, perm(reviews) |

## sellerApplicationRoutes — `/seller`
| POST | `/apply` | sellerApply | (public) |
| GET | `/apply/status` | sellerApplyStatus | (public) |
| GET | `/apply/setup` | sellerSetupState | signed token |
| POST | `/apply/complete-setup` | completeSetup | signed token |
| GET | `/status` | sellerStatusMe | authU |
| GET | `/dashboard` | sellerDashboard | authU, approved |
| GET | `/store` | sellerStore | authU, approved |
| PATCH | `/store` | sellerStoreUpdate | authU, approved |

## shippingRoutes — `/shipping`
| GET | `/config` | getShippingConfig | authA, perm(shipping) |
| GET | `/rules` | getActiveShippingRules | (public) |
| GET | `/methods` | getActiveShippingMethods | (public) |
| POST | `/quote` | quoteShipping | (public) |
| PUT | `/admin/config` | updateShippingConfig | authA, perm(shipping) |
| GET | `/admin/rules` | getShippingRules | authA, perm(shipping) |
| POST | `/admin/rules` | createShippingRule | authA, perm(shipping) |
| PUT | `/admin/rules/:id` | updateShippingRule | authA, perm(shipping) |
| DELETE | `/admin/rules/:id` | deleteShippingRule | authA, perm(shipping) |
| PATCH | `/admin/rules/:id/toggle` | toggleShippingRule | authA, perm(shipping) |
| GET | `/admin/methods` | getShippingMethods | authA, perm(shipping) |
| POST | `/admin/methods` | createShippingMethod | authA, perm(shipping) |
| PUT | `/admin/methods/:id` | updateShippingMethod | authA, perm(shipping) |
| DELETE | `/admin/methods/:id` | deleteShippingMethod | authA, perm(shipping) |
| PATCH | `/admin/methods/:id/toggle` | toggleShippingMethod | authA, perm(shipping) |

## stockRoutes — `/stock`
| GET | `/` | getStockOverview | authA, perm(manageStock) |
| POST | `/adjust` | adjustStock | authA, perm(manageStock) |
| GET | `/history` | getStockHistory | authA, perm(manageStock) |

## storeRoutes — `/store`
| GET | `/public` | getPublicStoreInfo | (public, 60s cache) |
| GET | `/resolve` | resolveTenant | (public) |
| GET | `/check-subdomain` | checkSubdomain | (public) |
| PUT | `/domain` | updateStoreDomain | authA, perm(store) |
| GET | `/` | getStoreInfo | authA |
| PUT | `/` | updateStoreInfo | authA, perm(store), upload |

## superAdminRoutes — `/super-admin`
Auth (public):
| POST | `/auth/login` | loginSuperAdmin |
| POST | `/auth/refresh-token` | refreshSuperAdminToken |
| POST | `/auth/logout` | logoutSuperAdmin |
| GET | `/auth/me` | meSuperAdmin | sa |

Dashboard/activity:
| GET | `/dashboard` | getDashboard | sa |
| GET | `/activity/me` | myActivity | sa |

Requests:
| GET | `/requests` | listRequests | sa |
| GET | `/requests/:id` | getRequest | sa |
| PATCH | `/requests/:id` | updateRequest | sa |
| DELETE | `/requests/:id` | deleteRequest | sa |
| POST | `/requests/:id/approve` | approveRequest | sa |
| POST | `/requests/:id/reject` | rejectRequest | sa |
| POST | `/requests/:id/request-info` | requestInfo | sa |

Stores:
| GET | `/stores` | listStores | sa |
| GET | `/stores/:id` | getStore | sa |
| POST | `/stores` | createStore | sa |
| POST | `/stores/with-owner` | createSellerStore | sa |
| PATCH | `/stores/:id` | updateStore | sa |
| DELETE | `/stores/:id` | deleteStore | sa |
| PATCH | `/stores/:id/status` | setStoreStatus | sa |
| POST | `/stores/:id/admin-access` | openStoreAdmin | sa |

Store admins:
| GET | `/store-admins` | listStoreAdmins | sa |
| GET | `/store-admins/:id` | getStoreAdmin | sa |
| PATCH | `/store-admins/:id` | updateStoreAdmin | sa |
| POST | `/store-admins/:id/password` | resetStoreAdminPassword | sa |
| PATCH | `/store-admins/:id/status` | setStoreAdminStatus | sa |

Users:
| GET | `/users` | listUsers | sa |
| GET | `/users/:id` | getUser | sa |
| PATCH | `/users/:id` | updateUser | sa |
| DELETE | `/users/:id` | deleteUser | sa |
| POST | `/users/:id/password` | setUserPassword | sa |
| PATCH | `/users/:id/status` | setUserStatus | sa |

Team:
| GET | `/team` | listTeam | sa |
| POST | `/team` | createTeamMember | sa |
| GET | `/team/:id` | getTeamMember | sa |
| GET | `/team/:id/activity` | teamMemberActivity | sa |
| PATCH | `/team/:id` | updateTeamMember | sa |
| PATCH | `/team/:id/status` | setTeamMemberStatus | sa |
| POST | `/team/:id/password` | resetTeamMemberPassword | sa |
| DELETE | `/team/:id` | deleteTeamMember | sa |

Plans:
| GET | `/plans` | listPlans | sa |
| POST | `/plans` | createPlan | sa |
| GET | `/plans/:id/activity` | planActivity | sa |
| GET | `/plans/:id` | getPlan | sa |
| PATCH | `/plans/:id` | updatePlan | sa |
| PATCH | `/plans/:id/status` | setPlanStatus | sa |
| DELETE | `/plans/:id` | deletePlan | sa |

## tagRoutes — `/tags`
| GET | `/` | getAllTags | authA |
| POST | `/` | createTag | authA |
| PUT | `/:id` | updateTag | authA |
| DELETE | `/:id` | deleteTag | authA |

## translationRoutes — `/translations`
| POST | `/page` | translatePage | authA |

## userRoutes — `/users`
| POST | `/register` | createUser | (public, RL) |
| POST | `/register/check` | checkRegistration | (public) |
| POST | `/login` | loginUser | (public, RL) |
| POST | `/admin/login` | loginAdmin | (public, RL) |
| POST | `/refresh-token` | refreshAccessToken | (public) |
| POST | `/admin/refresh-token` | refreshAdminAccessToken | (public) |
| POST | `/admin/handoff` | createStoreHandoff | authA |
| POST | `/admin/handoff/exchange` | exchangeStoreHandoff | (public) |
| POST | `/logout` | logoutUser | auth |
| POST | `/google-login` | googleLogin | (public) |
| POST | `/google-customer-login` | googleCustomerLogin | (public) |
| GET | `/email-health` | getEmailHealth | authA |
| POST | `/send-email-otp` | sendEmailVerificationOtp | (public, RL) |
| POST | `/verify-email-otp` | verifyEmailVerificationOtp | (public, RL) |
| POST | `/forgot-password` | sendForgotPasswordOtp | (public, RL) |
| POST | `/verify-reset-otp` | verifyForgotPasswordOtp | (public, RL) |
| POST | `/reset-password` | resetPasswordWithOtp | (public) |
| GET | `/me` | getMe | auth |
| GET | `/profile` | getProfile | auth |
| PUT | `/profile` | updateProfile | auth, perm(profile) |
| PUT | `/password` | changePassword | auth, perm(profile) |
| PUT | `/phone` | updatePhone | authU |
| POST | `/checkout-drafts` | createCheckoutDraft | authU |
| GET | `/checkout-drafts` | getCheckoutDrafts | authU |
| GET | `/checkout-drafts/:id` | getCheckoutDraft | authU |
| PUT | `/checkout-drafts/:id` | updateCheckoutDraft | authU |
| DELETE | `/checkout-drafts/:id` | deleteCheckoutDraft | authU |
| GET | `/wishlist` | getWishlist | authU |
| PUT | `/wishlist/toggle` | toggleWishlist | authU |
| PUT | `/profile` | updateProfileREST | auth (duplicate route — second handler unreachable) |
| POST | `/change-password` | changePasswordREST | auth |

> ⚠️ Duplicate `PUT /users/profile`: pehla `updateProfile` (perm profile), doosra `updateProfileREST` unreachable. See [10-notes-and-issues.md](10-notes-and-issues.md).

## variantRoutes — `/variants`
| POST | `/` | createVariant | authA, staff, perm(products), upload |
| GET | `/next-sku` | getNextSkuNumber | authA, staff, perm(products) |
| PUT | `/:id` | updateVariant | authA, staff, perm(products), upload |
| DELETE | `/:id` | deleteVariant | authA, staff, perm(products) |
| GET | `/` | getVariants | authA, staff, perm(products) |
| GET | `/:id` | getVariantById | authA, staff, perm(products) |

## vendorRoutes — `/vendors`
| GET | `/next-code` | getNextVendorCode | authA, perm(vendors) |
| GET | `/admin/all` | getVendorsAdmin | authA, perm(vendors) |
| GET | `/:id/details` | getVendorWithPOs | authA, perm(vendors) |
| GET | `/:id` | getVendorById | authA, perm(vendors) |
| POST | `/` | createVendor | authA, perm(vendors) |
| PUT | `/:id` | updateVendor | authA, perm(vendors) |
| DELETE | `/:id` | deleteVendor | authA, perm(vendors) |
| POST | `/:id/restore` | restoreVendor | authA, perm(vendors) |

---

## Cross-cutting

- Har request under `API_PREFIX` pehle `resolveStore` middleware chalta hai (host → store) → `runWithStore()` AsyncLocalStorage.
- Static uploads: `/uploads` (Express static) with immutable cache.
- Health: `GET API_PREFIX/health`.
- 404 handler + global error handler `server.js` end me.
- Socket.IO same server pe, tenant-aware Proxy (`utils/socket.js`).
