# ADMIN PANEL COMPLETE WORKFLOW REPORT

## Is report ko kaise parhein

Yeh report repository ke maujooda admin/staff panel ko beginner-friendly zaban mein samjhati hai. Is mein customer storefront ka shopping flow shamil nahi; customer/order records ka zikr sirf wahan hai jahan admin panel unko manage karta hai. API paths backend ke configured API prefix ke baad likhe gaye hain. Asal prefix `backend/server.js` mein `API_PREFIX` se mount hota hai; frontend base URL configuration se milta hai.

**Evidence rule:** “Confirmed” ka matlab hai ke page, API route/controller ya model code mein behavior maujood hai. Jahan frontend aur backend ka behavior mukammal taur par match nahi karta, usay “Implementation note” ya “Gap” kaha gaya hai. Database ke live records is source review se verify nahi kiye ja sakte.

## 1. Admin sidebar: har section aur uska page

Sidebar `frontend/src/components/adminComponents/Sidebar.js` mein defined hai. Route aur frontend permission mapping `frontend/src/app/admin/AdminLayoutClient.js` mein hai. Har listed item ka page source maujood hai:

| Sidebar section | Page |
| --- | --- |
| Dashboard | `frontend/src/app/admin/dashboard/page.js` |
| Brands | `frontend/src/app/admin/brands/page.js` |
| Categories | `frontend/src/app/admin/categories/page.js` |
| Attributes | `frontend/src/app/admin/attributes/page.js` |
| Products | `frontend/src/app/admin/products/page.js` |
| Featured Products | `frontend/src/app/admin/featured-products/page.js` |
| Reviews | `frontend/src/app/admin/reviews/page.js` |
| Discounts | `frontend/src/app/admin/discounts/page.js` |
| Deals | `frontend/src/app/admin/deals/page.js` |
| Banners | `frontend/src/app/admin/banners/page.js` |
| Manage Stock | `frontend/src/app/admin/manage-stock/page.js` |
| Orders | `frontend/src/app/admin/orders/page.js` |
| Shipping | `frontend/src/app/admin/shipping/page.js` |
| Vendors | `frontend/src/app/admin/vendors/page.js` |
| Purchase Orders | `frontend/src/app/admin/purchase-orders/page.js` |
| Customers | `frontend/src/app/admin/customers/page.js` |
| Leads | `frontend/src/app/admin/leads/page.js` |
| POS | `frontend/src/app/admin/pos/page.js` |
| Store Info | `frontend/src/app/admin/store-info/page.js` |
| Employees | `frontend/src/app/admin/employees/page.js` |
| Profile | `frontend/src/app/admin/profile/page.js` |
fdg
Sidebar mein Customers, Leads aur POS ka group **POS & Customer Management** hai; Vendors/Purchase Orders ka group **Purchasing** hai. Dono pages aur routes alag features hain.

## 2. Login, session aur dashboard tak ka safar

1. Admin ya employee `frontend/src/app/admin/login/page.js` par login karta hai. Frontend admin login request `/users/admin/login` bhejta hai.
2. `backend/routes/userRoutes.js` is request ko login controller (`backend/controllers/userController.js`, `loginAdmin`) tak bhejta hai. Admin-panel credentials employee account se verify kiye jate hain; login/refresh/logout routes alag maujood hain.
3. Authentication token cookie ya Authorization Bearer header mein aa sakta hai. `backend/middleware/authMiddleware.js` token verify karke `Employee` ya `User` record load karta hai; inactive/deleted record ko reject karta hai. Secret values report mein shamil nahi hain.
4. `AdminLayoutClient.js` profile `GET /users/profile` se leta, login status check karta aur permission ke mutabiq route allow/deny karta hai. `frontend/src/app/admin/layout.js` language provider ke andar admin layout wrap karta hai.
5. Admin Dashboard `/admin/dashboard` par jata hai. Page `dashboardApi.getStats(range)` se `GET /dashboard/stats` mangta hai. `backend/routes/dashboardRoutes.js` authentication ke baad `dashboardController.getDashboardStats` chalata hai. Controller `Order`, `Product`, `Brand`, `Category`, aur `Discount` se summary/graph data banata hai. Dashboard mein range selection, totals, charts, recent activity aur shortcuts hain; actual numbers database par depend karte hain.

Dashboard page `useAdminSocket`/event listeners se kuch order, product, brand, category, deal, discount aur activity changes ke baad refresh hota hai. Yeh admin UI refresh mechanism hai, koi alag business record/model nahi.

## 3. Har admin section ka practical workflow

### 3.1 Dashboard

- **Maqsad / kholna:** Business ka overview; `/admin/dashboard` page.
- **Dekhna/filter:** Date range (7 din, 30 din, 3/6 mahine, 1 saal) select karke sales/orders aur doosre dashboard summaries/charts dekhe ja sakte hain. Data dashboard API se aata hai; kisi dashboard record ko yahan create nahi kiya jata.
- **Add/edit/delete:** Dashboard read-only summary hai. Is page se order, product ya discount record edit nahi hota; cards ke shortcuts related sections par le jate hain.
- **Backend/data:** `GET /dashboard/stats` → `dashboardController.getDashboardStats`; models mein `Order`, `Product`, `Brand`, `Category`, `Discount` se aggregation/query.
- **Dependencies/result:** Doosre modules ke data par depend karta hai. Date range badalne par stats refetch hote hain; supported live events par query refresh ho sakti hai.
- **Staff access:** Sidebar key `dashboard`; backend route mein authentication hai lekin `checkPermission` gate nahi. Frontend route guard dashboard ko explicit `dashboard: false` par deny karta hai. Isliye frontend/backend gate behavior ek jaisa strict nahi.

### 3.2 Brands

- **Maqsad / kholna:** Product makers/brands ki list aur unki profile; `/admin/brands`, detail `/admin/brands/:id`.
- **Dekhna:** `brandApi` se `GET /brands/admin/all` list, optional pagination/search params. Detail page brand aur uske products dikhata hai. Code form ke liye `GET /brands/next-code`.
- **Add:** Name/code/details/country aur optional logo bhar kar save. `POST /brands` multipart request; backend logo upload process karke `Brand` document banata hai.
- **Edit/delete:** Detail/list action se `PUT /brands/:id` (logo upload ho sakta hai) ya `DELETE /brands/:id`. Controller `updateBrand`/`deleteBrand`; frontend list ko invalidate/refresh karta hai.
- **Model/connections:** `backend/models/brand.js`; Product `brand_id` se brand ko reference karta hai. Deal targeting bhi brands select kar sakti hai.
- **Staff access/result:** Sidebar `brands`; backend `backend/routes/brandRoutes.js` ke admin list/create/update/delete mein auth + `checkPermission("brands")`. Public brand read routes bhi hain, magar admin mutation protected hai. Save ke baad brand list/detail aur product picker mein brand available hota hai.

### 3.3 Categories

- **Maqsad / kholna:** Products ko group karna, parent/child hierarchy banana; `/admin/categories`, detail route `/admin/categories/:id` bhi hai.
- **Dekhna:** Category page categories/admin list load karta hai, code `GET /categories/next-code` se leta hai. Search/filter aur parent-child selection UI mein hai.
- **Add:** Name/code/description/status aur optional parent select karke `POST /categories`. Existing attribute choose kiye ja sakte hain. Product add karte waqt quick category modal `frontend/src/components/admin/CategoryFormModal.js` bhi hai.
- **Attributes assign:** Attribute definition alag `Attribute` document hai. Category form existing attributes la kar selected IDs/config save karta hai. Kuch UI paths create request mein assignments bhejte hain; quick-add modal category create ke baad selected assignments ke liye `PUT /categories/:id/attributes` bhi karta hai. Isliye hamesha do calls nahi hotin.
- **Edit/delete:** `PUT /categories/:id`, assignment update `PUT /categories/:id/attributes`, delete `DELETE /categories/:id`.
- **Model/connections:** `Category` (`backend/models/Category.js`); `parent_category_id` isi model ka reference hai. `attributes[]` embedded assignment rakhta hai, jahan `attribute_id` Attribute ko reference karta hai. Product mein `category_id` reference hota hai; deals category ko target kar sakti hain.
- **Staff access/result:** Sidebar key `categories`, lekin backend `categoryRoutes.js` ke main list/create/edit/delete routes `checkPermission("products")` lagate hain. `/categories/admin/all` route authentication ke saath hai aur alag explicit permission check nahi. Category deletion par backend constraints/data handling controller se decide hoti hai; use har jagah hard-delete assume na karein.

### 3.4 Attributes

- **Maqsad / kholna:** Product/category properties aur unke selectable options maintain karna; `/admin/attributes`.
- **Dekhna:** `GET /attributes`; list UI searchable/paginated ho sakti hai (API wrapper query params support karta hai). Attribute ke linked categories dekhne ke liye `GET /attributes/:id/categories`.
- **Add/edit/delete:** Form se name, data type, grouping/unit, options/values aur variant-related setting de kar `POST /attributes`; edit `PUT /attributes/:id`; delete `DELETE /attributes/:id`. Category links `PUT /attributes/:id/categories` se manage ho sakte hain.
- **Model/connections:** `Attribute` model property ki definition aur option labels/values rakhta hai. Category ke `attributes[].attribute_id` assignment aur settings alag hain. Variant form category ke attribute hierarchy se variant options dikhata hai; Product variant `Variant.attributes` mein selected values rakhta hai.
- **Staff access/result:** Backend `attributeRoutes.js` auth + `checkPermission("attribute")` lagata hai. Save ke baad category assignment/variant forms mein woh definition istemal ho sakti hai. Attribute ko add karna apne aap kisi product par uski value set nahi karta.

### 3.5 Products

- **Maqsad / kholna:** Product catalog list/detail aur product/variant management; `/admin/products`, detail `/admin/products/:id`.
- **Dekhna:** `productApi` `/products` se list, filters/pagination params; detail `GET /products/:id`. UI status/search/filters aur product summary dikhata hai.
- **Add:** `ProductFormModal` categories aur brands load karta hai. Staff required category + brand choose karta, name/description/status/tags/perishable fields bhar kar `POST /products` karta hai. Product ke liye Category aur Brand dono required backend references hain.
- **Edit/delete/status:** `PUT /products/:id`; `DELETE /products/:id`; status `PATCH /products/:id/toggle-status`. Images wale requests upload/validate/save middleware se guzarte hain.
- **Variants:** Base product ke baad product detail/Add Variant page par variant banaya jata hai; `POST /variants` alag request hai. Variant mein SKU, price, quantity, attributes/images hoti hain.
- **Model/connections:** `Product` (`backend/models/Product.js`) → `Category`, `Brand`; variant → `Product`; tags/tag references bhi use hote hain. Backend controller extra `specifications` accept/validate kar sakta hai, lekin current `ProductFormModal` create submission mein specs/variant list automatically bhejna code se verify nahi hota.
- **Staff access/result:** `productRoutes.js` mein create/edit/delete/status ke liye auth + products permission. Successful save ke baad product list/detail aur dependent pickers update/cache refresh hote hain.

### 3.6 Featured Products

- **Maqsad / kholna:** Existing products mein se featured items choose karna; `/admin/featured-products`.
- **Dekhna/select:** Yeh alag product catalog/model nahi; page product records ko feature status ke saath list/manage karta hai. Search/filter/selection UI page mein hai.
- **Action:** Single item toggle `PATCH /products/:id/toggle-featured`; bulk selection `PATCH /products/bulk-featured`. Backend controller product ke featured flag ko update karta hai. Is page par naya Product create nahi hota.
- **Model/connections:** `Product` hi store hota hai; storefront featured placement us field se consume ho sakta hai. Specific display placement/ordering ko alag feature samajhne ke bajaye code ke actual product flag ke taur par samjhein.
- **Staff access/result:** Sidebar key `featuredProducts`, legacy fallback `products`; backend routes `checkPermission("featuredProducts")` use karte hain. Change ke baad list/cache refresh hota hai.

### 3.7 Reviews

- **Maqsad / kholna:** Submitted reviews dekhna, hide/show karna aur admin response dena; `/admin/reviews`, detail `/admin/reviews/:id`.
- **Dekhna:** `GET /reviews/admin/all` page/search/rating/status/sort params leta hai; stats/pagination aate hain. Detail `GET /reviews/admin/:id`.
- **Action:** Status `PATCH /reviews/:id/status` (visible/hidden state), response `PATCH /reviews/:id/response`, response hatana `DELETE /reviews/:id/response`. Page par review ka reply/status action available hai. Review create/update/delete customer-facing routes bhi alag hain; yeh admin UI ka normal moderation workflow nahi.
- **Model/connections:** `Review` product aur reviewer se linked hai. Controller `Product`, `Order`, `User`, `Employee` use karta; verified purchase/delivered order check bhi review path mein maujood hai. Product ke public review display par status asar karta hai.
- **Staff access/result:** Admin list/status/response routes `checkPermission("reviews")`; sidebar legacy `products` fallback rakhta hai. `DELETE /reviews/:id` route auth-only hai (module check nahi); admin UI ke normal moderation buttons hard delete ke barabar nahi.

### 3.8 Discounts

- **Maqsad / kholna:** Coupon/discount rule create/manage karna; `/admin/discounts`, detail `/admin/discounts/:id`.
- **Dekhna:** List/detail APIs `GET /discounts`, `GET /discounts/:id`; list UI status/type/search filters support karti hai.
- **Add/edit/delete:** Rule type/value/code, validity/limits aur target selection bhar ke `POST /discounts`; `PUT /discounts/:id` se edit; `DELETE /discounts/:id` se delete. Record status/details detail page par manage hotay hain.
- **Connections:** `Discount` model; controller product/brand/category target arrays resolve karta hai. `orderController` discount calculation helper use karta hai, so discount application order calculation ke flow mein connected hai. Public `GET /discounts/public` available hai.
- **Staff access/result:** Important gap: `discountRoutes.js` mutation/read admin endpoints par `authMiddleware` hai magar `checkPermission("discounts")` nahi. Sidebar/frontend par discounts permission hai; backend route is module permission ko enforce nahi karta. Authenticated user, jiske token ko middleware accept kare, endpoint hit kar sakta hai. Yeh confirmed route-code observation hai, live exploit test nahi.

### 3.9 Deals

- **Maqsad / kholna:** Product/category/brand target par promotion ya deal configure karna; `/admin/deals`, detail `/admin/deals/:id`.
- **Dekhna:** `GET /deals` list, `GET /deals/:id` detail; date/status/search aur selected target records UI mein inspect hote hain.
- **Add/edit/status/delete:** Form mein deal kind, timing/limits, apply-to target aur selected Products/Categories/Brands select karke `POST /deals`; edit `PUT /deals/:id`; status `PATCH /deals/:id/toggle-status`; delete `DELETE /deals/:id`.
- **Connections:** `Deal` model. Controller mein bundle reward types bhi handle hote hain; public `GET /deals/active` aur `/deals/active/:id` frontend/public use ke liye hain. `orderController` Deal aur Bundle read karta hai, isliye order pricing mein applicable promotions inspect hoti hain. Deal selected products/categories/brands ka relationship actual selected IDs par depend karta hai.
- **Staff access/result:** `dealRoutes.js` admin endpoints auth + `checkPermission("deals")` use karte hain. Save/toggle ke baad active deal listing/cache update hoti hai.

### 3.10 Banners

- **Maqsad / kholna:** Promotional banner image/text/link content manage karna; `/admin/banners`, detail `/admin/banners/:id`.
- **Dekhna:** `GET /banners/admin/all` admin listing; public active listing `GET /banners/active`.
- **Add/edit/toggle/duplicate/delete:** Image/content/link/active schedule jaisi form values ke saath multipart `POST /banners`; edit `PUT /banners/:id`; active state `PATCH /banners/:id/toggle`; copy `POST /banners/:id/duplicate`; delete `DELETE /banners/:id`.
- **Connections:** `Banner` model/controller image upload aur banner records manage karte hain. `GET /banners/active` implementation banner ko public site tak expose karne ka confirmed destination hai; exact placement/layout storefront components se decide hota hai, sirf admin page se har placement verify nahi hoti.
- **Staff access/result:** All admin mutations/list route `authMiddleware` + `checkPermission("banners")`. Changes cache invalidate karke public active banner feed ko affect karte hain.

### 3.11 Manage Stock

- **Maqsad / kholna:** SKU/variant ke current quantity aur stock movement history dekhna; `/admin/manage-stock`.
- **Dekhna/search/filter:** `GET /stock` paginated list/search/status; `GET /stock/history` movements, optional `variant_id`. Page status counts (in stock/low/out) aur history dikhata hai.
- **Stock adjustment:** Staff variant select karke adjustment quantity/reason submit karta hai: `POST /stock/adjust`. `stockController.adjustStock` `Variant.quantity` update karta aur `StockHistory` movement record banata hai. Yeh product master data ko dobara create nahi karta.
- **Connections/result:** Stock level asal mein `Variant` document par hai, Product par nahi. POS/order flows aur Purchase Order receiving stock/variants se related hain. Socket event/query refresh se stock UI update ho sakti hai.
- **Staff access:** `stockRoutes.js` har list/adjust/history endpoint par auth + `checkPermission("manageStock")` lagata hai. Unauthorized request 401/403 ke sath rukti hai.

### 3.12 Orders

- **Maqsad / kholna:** Customer orders ka admin queue/detail manage karna; `/admin/orders`, detail `/admin/orders/:id`.
- **Dekhna/filter:** `GET /orders/admin/all` status, payment, shipping, date/search/page params leta hai. Page totals/counts aur product summary `GET /orders/admin/product-summary` se bhi leti hai. Detail `GET /orders/admin/:id`.
- **Process/edit:** Admin order status `PATCH /orders/admin/:id/status` se aur payment state `PATCH /orders/admin/:id/payment` se update karta hai. Order table selection, status/payment filters aur detail page par order/items/customer/shipping/payment information dekhi jati hai. Admin UI mein general order delete/edit button har case mein assume nahi karna chahiye; route file mein customer-side edit/delete alag hai.
- **Connections:** `Order` model order ke customer, item/product/variant, payment aur shipping snapshots rakhta hai. `orderController` `Product`, `Variant`, `Address`, `Discount`, `Deal`, `Bundle`, `ShippingMethod` aur `CheckoutDraft` use karta; order place/status ke baad stock/order events bhi emit hote hain. Customer profile mein order history ka relation controller se verify kiya ja sakta hai.
- **Staff access/result:** Admin read/status/payment routes auth + `checkPermission("order")`. Sidebar key `order` hai (Employee schema mein plural `orders` bhi maujood hai, is liye exact key `order` samjhein). Updates order list/detail aur live listeners refresh karte hain.

### 3.13 Shipping

- **Maqsad / kholna:** Delivery settings, shipping price rules aur available methods configure karna; `/admin/shipping`.
- **Dekhna/edit config:** `GET /shipping/config`; admin settings `PUT /shipping/admin/config` se save. Rules admin list `GET /shipping/admin/rules`; create/update/delete/toggle: `POST`, `PUT`, `DELETE`, `PATCH /shipping/admin/rules/:id/toggle`.
- **Methods:** `GET /shipping/admin/methods`; create `POST`, update `PUT`, delete `DELETE`, enable/disable `PATCH /shipping/admin/methods/:id/toggle`.
- **Model/connections:** `ShippingConfig`, `ShippingRule`, `ShippingMethod`. Public config/rules/methods aur `POST /shipping/quote` calculation endpoints bhi hain. Order controller ShippingMethod ko read karta hai. Shipping settings order record ko apne aap shipped/delivered nahi kar detin; order status Orders module mein update hota hai.
- **Staff access/result:** Admin management routes `checkPermission("shipping")` ke saath protected. Socket sync shipping configuration/method changes ke baad UI refresh kar sakta hai.

### 3.14 Vendors

- **Maqsad / kholna:** Suppliers ka address/contact aur purchasing history manage karna; `/admin/vendors`, detail `/admin/vendors/:id`.
- **Dekhna:** `GET /vendors/admin/all` supports search/page filters; detail `GET /vendors/:id`; linked purchase orders/payments ke liye `GET /vendors/:id/details`; code `GET /vendors/next-code`.
- **Add/edit/delete/restore:** `VendorFormModal` se `POST /vendors`; edit `PUT /vendors/:id`; delete `DELETE /vendors/:id`; restore `POST /vendors/:id/restore`. Delete ko soft-delete/restore workflow samjhein, permanent erase assume na karein.
- **Connections:** `Vendor` model ko `PurchaseOrder.vendor_id` reference karta hai; PO vendor snapshot bhi save karta hai. Vendor detail page purchase orders, payments/activity tabs dikha sakta hai.
- **Staff access/result:** Vendor list/details/write routes mein auth + `checkPermission("vendors")`. Save ke baad PO form ka vendor selector is vendor ko use karta hai.

### 3.15 Purchase Orders

- **Maqsad / kholna:** Vendor se stock khareedne ka PO banana, confirm/cancel, receiving aur payment record karna; `/admin/purchase-orders`, new `/new`, detail `/:id`.
- **Add:** `GET /purchase-orders/next-code` se PO number; vendor aur product variants/quantity/cost/tax/expected dates choose karke `POST /purchase-orders`. `PurchaseOrder` mein item product/variant references aur vendor snapshot hota hai.
- **Dekhna/edit/status:** `GET /purchase-orders/admin/all`, detail `/admin/:id`; edit `PUT /purchase-orders/:id`; confirm `PATCH /purchase-orders/admin/:id/confirm`; cancel `/cancel`; close `/close`.
- **Receive stock/payment:** Delivery/receiving `POST /purchase-orders/admin/:id/deliver` (route mein purchaseOrders + manageStock permission); receive alias `/receive` bhi hai. `purchaseOrderController.deliverPO` received quantities, `Variant` quantity aur `StockHistory` update karta hai. Payment `PATCH /purchase-orders/admin/:id/payment` se `PurchasePayment`/PO payment totals update hote hain.
- **Dependencies/result:** Vendor, Product, Variant, StockHistory, PurchasePayment, PurchaseOrder. PO create karna turant stock receive karne ke barabar nahi; receiving action par actual inventory change hoti hai. `stockUpdated` event admin stock page ko refresh karwa sakta hai.
- **Staff access:** Routes auth + `checkPermission("purchaseOrders")`; receive/deliver par saath `checkPermission("manageStock")`. Payment route mein purchaseOrders permission hai.

### 3.16 Customers

- **Maqsad / kholna:** Customer records dekhna aur admin-created customer details maintain karna; `/admin/customers`, detail `/:id`.
- **Dekhna/search:** `GET /customers/admin/all` list; `GET /customers/search?search=...` POS/customer pickers ke liye; detail `GET /customers/:id`.
- **Add/edit/delete:** Customer form se `POST /customers`; `PUT /customers/:id`; `DELETE /customers/:id`. Page records search/paginate kar sakta hai; actual allowed form fields `CustomerFormModal`/controller decide karte hain.
- **Connections/model:** `Customer` model. Orders and POS sale records customer ID/snapshot rakh sakte hain. POS customer history ke liye alag `/pos/customers/:customerId/history` endpoint hai. Customer create/edit karna automatically order nahi banata.
- **Staff access/result:** `customerRoutes.js` auth + `checkPermission("customers")`; result list/detail aur POS/customer selectors mein nazar aata hai.

### 3.17 Leads

- **Maqsad / kholna:** Sales follow-up prospects track karna; `/admin/leads`, detail `/:id`.
- **Dekhna/add/edit:** `GET /leads` list filters; `POST /leads` creates lead; `GET /leads/:id` detail; `PUT /leads/:id` edits fields. Lead status `PATCH /leads/:id/status`; follow-up/activity `POST /leads/:id/activities`; delete `DELETE /leads/:id`.
- **Fields/connections:** `Lead` model status (New, Contacted, Qualified, Converted, Lost), contact/source, follow-up, assigned employee, interested category/products/variants, activities aur notes rakhta hai. Controller references Category/Product/Variant/Employee validate/populate karta hai.
- **Conversion:** `Converted` status exists, lekin inspected route/API mein lead ko Customer ya Order banane wala dedicated conversion endpoint confirm nahi hua. Is liye “Converted” status ko automatic customer/order creation na samjhein.
- **Staff access/result:** `leadRoutes.js` router-wide `authMiddleware`, `staffPermissionCheck`, `checkPermission("leads")` lagata hai. Yahan role allowlist admin/manager/staff hai aur leads permission bhi check hoti hai.

### 3.18 POS

- **Maqsad / kholna:** Store counter par in-person sale record karna; `/admin/pos`. History pages `/admin/pos/history` aur `/history/:id`.
- **Product selection/sale:** `GET /pos/products` se sellable product/variant search; staff cart items/qty, optional customer, discount/tax aur payment details select karke `POST /pos/sales` karta hai. `PosSale` mein item snapshots, Product/Variant IDs, amount/payment/cashier/customer snapshot save hotay hain.
- **History/edit/return:** Sales list `GET /pos/sales`; detail `GET /pos/sales/:id`; existing sale edit `PUT /pos/sales/:id`; item return/refund `POST /pos/sales/:id/returns`. Customer POS history `GET /pos/customers/:customerId/history`. UI return panels past returned items/reason/refund dekhte hain.
- **Stock/connections:** `posController` Product, Variant, Customer, PosSale, StockHistory models use karta hai; sale/return stock movement se connect hai. POS sale `Order` model ke barabar nahi: code ka primary record `PosSale` hai.
- **Staff access/result:** `posRoutes.js` auth + `checkPermission("pos")`. Frontend page cart/receipt/history update karta; inventory result stock module mein reflect hota hai.

### 3.19 Store Info

- **Maqsad / kholna:** Store ka logo/contact/address/settings/business info maintain karna; `/admin/store-info`.
- **Dekhna/edit:** Current store `GET /store`; update `PUT /store` (logo upload bhi). Frontend `store-info/page.js` form aur preview mein multiple store information fields dikhata hai; save par `storeApi` use hota hai.
- **Model/connections:** `Store` model aur `storeController.getStoreInfo/updateStoreInfo`. Public `GET /store/public` store display ke liye hai. Admin layout/store socket sync store change par cached profile/UI refresh kar sakta hai. Exact har field ka downstream use alag consumers par depend karta hai.
- **Staff access:** Backend GET `/store` authenticated hai magar module permission check nahi; PUT `/store` `checkPermission("store")` use karta. Page khud profile read karke edit permission `admin` role ya `permissions.store` se decide karta hai.

### 3.20 Employees

- **Maqsad / kholna:** Admin panel ke staff accounts, status, roles, permissions aur activity manage karna; `/admin/employees`, detail `/:id`.
- **Dekhna/add:** Employee list `GET /employees`; detail `GET /employees/:id`; create form `POST /employees` se name/username/email/password/role/status aur permissions save karta hai. Password report/log mein expose nahi kiya gaya.
- **Edit/deactivate/delete:** `PUT /employees/:id`, `PATCH /employees/:id/toggle-status`, `DELETE /employees/:id`. Page forms ke permission switches se access control values assign karta hai; disable/soft delete ka exact data behavior `employeeController` mein hai.
- **Model/access:** `Employee` model roles enum `user`, `admin`, `staff`, `manager`; permission booleans dashboard/products/brands/categories/discounts/deals/store/banners/manageStock/shipping/order/attribute/vendors/purchaseOrders/customers/leads/pos/featuredProducts/reviews waghera rakhta hai. Login `authMiddleware` employee token ko Employee se resolve karta hai.
- **Staff access/result:** Employee routes sab authentication maangte hain. GET routes par `employees` permission gate nahi; POST/PUT/DELETE/status-toggle par `checkPermission("employees")`. Backend admin bypass karta hai. Permission changes `permissionsUpdated`/employee update Socket.IO events se current layout/sidebar ko refresh kar sakte hain.

### 3.21 Profile

- **Maqsad / kholna:** Logged-in employee/admin ki apni account details aur password update karna; `/admin/profile`.
- **Dekhna/edit:** Is page ka current UI REST profile GET ke bajaye Socket.IO use karta hai. Connect hone par `socket.emit("getProfile")` aur `socket.emit("getStoreInfo")`; response `profileData`/store events par screen fill hoti hai. Save `socket.emit("updateProfile", payload)`; password change `socket.emit("changePassword", ...)`. Page mein edit/save/cancel aur password visibility controls hain. Yeh kisi doosre employee ki profile edit karne ka shortcut nahi.
- **Backend/model:** Socket handlers `backend/utils/socket.js` mein hain aur `userController.updateProfileInfo` / `changePasswordSocket` call karte hain. `GET /users/profile`, `PUT /users/profile`, `PUT /users/password`, `PUT /users/phone` REST endpoints bhi maujood hain, lekin current profile page ka main save/password path socket hai. Controller login identity ke mutabiq User/Employee data handle karta.
- **Staff access/result:** Sidebar/route key `profile`; frontend page permissions (`profile`, aur store fields ke liye `store`) ke mutabiq editable fields dikhata. Profile save/password socket handler ka actual authorization `backend/utils/socket.js` mein hai; REST endpoints par auth/permission rules alag hain. Socket response profile data refresh karta.

## 4. Modules ke darmiyan confirmed connections

Yeh arrows flowchart mein useful hain; har arrow ka matlab source mein reference, API use, ya controller operation verified hai:

1. **Category → Attribute → Product/Variant:** Category ka parent doosri Category ko ref karta hai. Category `attributes[]` mein `Attribute` refs/settings hain. Product required Category ref rakhta hai. Variant form category attribute hierarchy se options le sakta hai; Variant par chosen values save hoti hain.
2. **Brand → Product:** `Product.brand_id` Brand ko ref karta hai. Deal targeting brand IDs bhi use kar sakti hai.
3. **Product → Featured Products:** Alag Featured model/page nahi; `Product` featured flag patch hota hai.
4. **Product → Reviews:** Review Product se linked; review status public visibility control karta hai. Verified purchase check Order se related hai.
5. **Product/Variant → Manage Stock:** Quantity `Variant` par; stock adjustments `StockHistory` log karti hai. Product screen Product aur uske variants ke zariye inventory tak pohanchti hai.
6. **Discounts/Deals → Orders:** Order controller discount calculation, Discount, Deal aur Bundle data use karta hai. Discount target product/category/brand ho sakta hai; Deal selected target IDs par apply hota hai. Exact eligibility rule controller implementation hai.
7. **Banners → Public banner feed:** Active banners endpoint public consumer ko data deta hai. Admin code se exact homepage placement ki har detail prove nahi hoti.
8. **Orders → Shipping/stock/customer:** Order mein item, customer, shipping/payment information; order controller Variant/ShippingMethod/Address aur pricing modules use karta. Shipping module config/method/quote provide karta. Order status Orders page se badalta hai; shipping config khud status advance nahi karti.
9. **Vendor → Purchase Order → Stock:** PO vendor, product/variant references rakhta. PO receive/deliver controller Variant quantity badhata aur StockHistory likhta hai. PO create/confirm par goods received maan lena ghalat hai.
10. **Customers → POS/Orders:** Customer IDs/snapshots POS sale aur order details se connect ho sakte hain; POS customer history route explicit hai. Customer record CRUD se sale/order automatically nahi banta.
11. **Leads → products/categories/employees:** Lead prospect ka interest, assigned Employee aur product/category references rakhta. Dedicated auto-convert-to-customer/order action verify nahi.
12. **POS → product/stock/sale/customer:** POS Product/Variant select karta, `PosSale` record banata, customer optional hai; sale/return stock history ke saath linked.
13. **Store Info → public store data:** Store model admin read/update aur public read route deta. Page/company consumer ke har use ko ek hi file se confirm nahi kiya ja sakta.
14. **Employees → permissions → panel/API:** Employee role/permissions sidebar aur frontend route guard mein dekhe jate; backend route middleware bhi kuch modules par permission check karta. Dono jagah implementation ek jaisi nahi, neeche access findings dekhein.
15. **Profile → current account:** `/users/profile` logged-in identity se record deta; employee management se alag self-service screen hai.

## 5. Admin aur staff access ka asal behavior

### Login aur roles

- Admin panel login route `/users/admin/login` hai. `Employee` model mein role enum `user`, `admin`, `staff`, `manager` hai; employee default role staff hai. `loginAdmin` exact acceptance logic `backend/controllers/userController.js` mein hai.
- `authMiddleware` JWT identity type dekh kar Employee/User load karta. Missing/invalid/expired token par 401; inactive/deleted account par request reject hoti hai.
- Backend `checkPermission(key)` admin ko bypass deta hai. Non-admin ke liye sirf `permissions[key] === false` block hota hai; **undefined permission key allow** hoti hai (legacy compatibility). Is ka matlab “permission missing hai to deny” nahi.
- `staffPermissionCheck` admin/manager/staff roles ko allow karta hai; Leads aur kuch variant operations is middleware ko use karte hain. Har route isay use nahi karta.

### Sidebar aur frontend route guard

- Sidebar employee profile/permission data ke baad menu filter karta. Most keys ke liye explicit `true` dikhata; dashboard key missing ho to show, aur Featured/Reviews ke liye legacy `products` fallback.
- `AdminLayoutClient.js` route-to-permission mapping se explicit `false` par access-denied redirect karta; agar kisi employee ke paas ek bhi true permission na ho to `/admin/access-denied`.
- Socket events `permissionsUpdated`, `authPermissionsUpdated`, `employeeUpdated` se live permission update/redirect support hai.

### Confirmed permission differences/gaps

- Har feature ka frontend hidden link akela backend security nahi. Har relevant backend route separately inspect karein.
- **Discounts:** backend admin CRUD routes authenticated hain lekin `checkPermission("discounts")` nahi lagate.
- **Employee reads:** `GET /employees` aur `GET /employees/:id` authenticated hain, lekin `employees` permission ke bina; writes permission check karte hain.
- **Store read:** authenticated `GET /store` par store permission check nahi; update par hai.
- **Categories:** backend main routes `checkPermission("products")` use karte, jabke sidebar key `categories` hai; `/categories/admin/all` mein explicit permission gate nahi. UI/backend access key mismatch flowchart mein note hona chahiye.
- **Dashboard:** dashboard API auth-only; UI guard dashboard permission dekh sakta hai.
- **Reviews:** moderation routes reviews permission check karte; review delete endpoint auth-only hai.
- **Leads:** router-wide auth + explicit allowed-role middleware + `leads` permission check.

Yeh source-code behavior ka report hai, security testing/audit certification nahi.

## 6. Admin panel ki multilingual system

- Provider `frontend/src/i18n/LanguageProvider.js`; admin layout ise wrap karta. `useTranslation()` se `locale`, `dir`, `locales`, `changeLocale`, `t()` milte hain.
- Locale definitions `frontend/src/i18n/config.js`: English, Urdu, Arabic, Spanish, French, German, Hindi, Chinese, Portuguese, Turkish. English default/fallback. Urdu/Arabic `rtl`, baqi listed locales `ltr`.
- Language preference `lang` cookie mein save hoti. Provider current language set karta aur wrapper par `lang`/`dir` attributes lagata; `translations.js` mein UI translation keys/dictionaries hain. Missing key ka fallback English/lookup behavior `translate()` mein hai; har text/key ka translation complete hona guaranteed nahi.
- Sidebar ke labels translation keys se resolve hote; pages par `t(...)` use hota hai, magar hard-coded English text bhi pages/components mein maujood hai. Isliye language switch har UI label ko translate kare yeh assume nahi.
- Database content ke liye `frontend/src/i18n/localize.js` translated name/description/labels par locale value leta, warna original English value dikhata. Category/Attribute/product/brand/banner/deal/review waghera model fields ke translations depend on model/controller support.
- Backend `backend/utils/translationService.js` content translate/persist queue/worker workflow aur `backend/utils/libreTranslate.js` translation backend adapter implement karte hain. `backend/scripts/argosTranslateServer.py` local Argos Translate ka LibreTranslate-compatible `/translate` bridge deta; `backfillTranslations.js` existing records ke liye script hai. Is bridge ki availability/config aur installed language models runtime par depend karte; source se yeh prove nahi hota ke har deployment mein woh chal raha hai.
- Auto-translation fail/missing ho to English/original field fallback hota hai. Codes/SKUs jaise identifiers translate nahi karne ke liye service rules hain; options mein display `label` translate ho sakta hai jabke matching `value` raw rehta hai.

## 7. Main admin journeys (flowchart ke liye step list)

### A. Category aur attributes setup

1. Login → Categories kholen → next code fetch.
2. Parent category optional select karein; name/details/status bharein.
3. Attribute pehle se ho to choose karein; nahi ho to Attributes section mein definition create karein (`POST /attributes`).
4. Category create karein (`POST /categories`); selected assignment UI flow ke mutabiq create payload ya `PUT /categories/:id/attributes` se save ho.
5. Naya Product banate waqt category picker se category select ho; category attributes baad mein variant/spec UI mein istemal ho sakte.

### B. Brand aur product

1. Brand list mein check/code fetch → brand details/logo ke saath create (`POST /brands`).
2. Product form mein category aur brand choose (dono required) → base product create (`POST /products`).
3. Product detail khol kar SKU/price/quantity/attribute values/images ke saath Variant alag create (`POST /variants`).
4. Variant quantity Manage Stock aur POS/Purchase Orders ke inventory flows mein use hoti.

### C. Featured products aur reviews

1. Featured Products mein existing products search/select → single/bulk featured toggle endpoint.
2. Reviews mein page/status/rating/search se review khojen → detail kholen → visible/hidden status set ya admin response likhen.
3. Product public display featured flag aur review visibility consume kar sakta; review hard delete ko normal hide action na samjhein.

### D. Discounts, deals aur banners

1. Discount form mein rule/value/validity/target configure → save; order calculation applicable Discount ko read karta.
2. Deal create/edit karein aur Products/Categories/Brands select karein; status active karein; active public endpoint deal data serve karta.
3. Banner image/content/link set karein → save → active toggle/schedule; public active feed update hota.
4. Yeh tino records alag models/endpoints hain; sirf save ho jana har storefront placement/eligibility ko prove nahi karta.

### E. Stock receive aur adjust

1. Vendor create/choose karein.
2. Purchase Order banayein: vendor + product variants + quantities/costs; PO pending.
3. PO confirm karein. Maal waqai aane par deliver/receive action karein; received qty Variant stock mein add, receiving log aur `StockHistory` update hoti hai.
4. Manage Stock par quantity/history dekhein; manual correction chahiye to reason ke saath stock adjustment submit karein.

### F. Customer order aur shipping status

1. Customer order system ke customer-order endpoint se banta; admin Orders page `GET /orders/admin/all` se record dekhta.
2. Order detail mein line items, customer, payment aur shipping snapshot review karein.
3. Admin order status aur payment status alag PATCH endpoints se update karta. Shipped/Delivered status manual order operation hai.
4. Shipping page par config/rules/methods manage hote; quote/order placement ke shipping calculation mein use hain. Settings change karna existing order ko automatically ship/deliver nahi karta.

### G. POS sale

1. POS page product/variant list search kare.
2. Items/qty, optional customer, discounts/tax/payment details set kare.
3. Submit → `POST /pos/sales` → `PosSale` save, cashier/customer/item snapshots record.
4. Return zarurat par sale history se sale choose karke return endpoint use kare; stock/history reflect hoti.

### H. Vendors, customers aur leads

1. Vendor section mein supplier create/update; PO mein vendor choose hota.
2. Customer section mein customer record create/edit/search; customer record ko POS/order ke saath explicitly select/reference karna hota.
3. Lead section mein prospect details, interest, assigned employee aur follow-up add; activities/status update karte rahein.
4. Lead ko “Converted” mark karne ka status hai, lekin automatic Customer/Order conversion route verify nahi hua.

### I. Store info, employees aur apna profile

1. Store Info load → store fields/logo update → save; public store endpoint read model deta.
2. Employees page → employee account create → role/permission toggles set → active/inactive status manage. Employee ka next login/session permission data se restricted panel dekhega; live permission events UI ko update karte hain.
3. Profile page → apni profile fetch → edit/save; password change supported form/API path se. Yeh kisi doosre employee ko edit karne ka shortcut nahi.

## 8. Source paths: workflow trace karne ke main points

- Sidebar/routes/guard: `frontend/src/components/adminComponents/Sidebar.js`, `frontend/src/app/admin/AdminLayoutClient.js`, `frontend/src/app/admin/layout.js`
- API mount aur HTTP server: `backend/server.js`
- Auth/permission: `backend/routes/userRoutes.js`, `backend/middleware/authMiddleware.js`, `backend/middleware/checkPermission.js`, `backend/models/Employee.js`
- Dashboard: `frontend/src/app/admin/dashboard/page.js`, `frontend/src/apis/admin/dashboardApi.js`, `backend/routes/dashboardRoutes.js`, `backend/controllers/dashboardController.js`
- Catalog: `frontend/src/app/admin/{brands,categories,attributes,products,featured-products,reviews}/`, `frontend/src/apis/admin/`, `backend/routes/`, `backend/controllers/`, `backend/models/Brand.js` (actual file casing `brand.js`), `Category.js`, `Attribute.js`, `Product.js`, `Variant.js`, `Review.js`
- Promotions: frontend `discounts/`, `deals/`, `banners/`; backend corresponding routes/controllers/models `Discount`, `Deal`, `Banner`
- Operations: frontend `manage-stock/`, `orders/`, `shipping/`; backend `stockController.js`, `orderController.js`, `shippingController.js`; models `Variant`, `StockHistory`, `Order`, `ShippingConfig`, `ShippingRule`, `ShippingMethod`
- Purchasing: frontend `vendors/`, `purchase-orders/`; backend `vendorController.js`, `purchaseOrderController.js`; models `Vendor`, `PurchaseOrder`, `PurchasePayment`
- Customer management: frontend `customers/`, `leads/`, `pos/`; backend `customerController.js`, `leadController.js`, `posController.js`; models `Customer`, `Lead`, `PosSale`
- Store/team/account: frontend `store-info/`, `employees/`, `profile/`; backend `storeController.js`, `employeeController.js`, `userController.js`; models `Store`, `Employee`
- Language/localization: `frontend/src/i18n/LanguageProvider.js`, `config.js`, `translations.js`, `localize.js`; backend `utils/translationService.js`, `utils/libreTranslate.js`, `scripts/argosTranslateServer.py`

## 9. Consolidated explanation: admin panel kaise mil kar kaam karta hai

Admin/staff login karta hai; frontend profile/session aur permissions load karke allowed sidebar/routes dikhata hai. User kisi section mein list/search/form use karta hai. Page API wrapper se configured backend API prefix par HTTP request bhejta hai. Express route authentication, aur jahan implemented ho module/role permission middleware chalata hai. Controller data validate karke Mongoose model(s) read/create/update karta: misal ke taur par Product create mein Category aur Brand IDs, variant/stock changes mein Variant aur StockHistory, PO receive mein Variant plus receiving history. Backend JSON result bhejta; frontend toast/state/query refresh se naya record dikhata. Kuch modules cache invalidate ya Socket.IO event emit karte hain, jis se doosre admin screens bhi refresh hote hain.

Daily management ka ek aam chain yeh hai: **Employees permissions set karte hain → Categories/Attributes aur Brands catalog ki bunyaad dete hain → Products aur Variants saleable items/SKU banate hain → Purchase Orders receiving se Variant stock bharte hain → Manage Stock adjustments/history dikhata hai → POS ya customer Orders sale record karte hain → Orders/Shipping status aur delivery configuration handle karte hain → Discounts/Deals pricing rules aur Banners marketing display ko support karte hain → Reviews moderation aur Customers/Leads relationship history maintain karte hain → Dashboard in modules se selected totals/activity ka overview deta hai.** Har arrow upar documented specific reference/API behavior par based hai; jahan conversion ya automatic storefront placement source mein confirm nahi, wahan usay automatic flow nahi maana gaya.
