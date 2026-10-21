# Admin/Staff Catalog Workflow (Simple Guide)

## Is file ka maqsad

Yeh guide ClickMaster ke **admin/staff catalog work** ko samjhati hai: login ke baad category, attribute, brand, product aur product variant kaise banaye jate hain, frontend kaunsi API call karta hai, aur backend kis database model mein data rakhta hai. Yeh customer ke shopping/cart/order flow ki guide nahi hai.

API paths neeche backend API prefix ke relative hain. Frontend ka actual server URL configuration se aata hai.

## Seedha overall flow

**Admin/staff login → Category banaye → Category ke liye attributes choose kare (optional) → Brand banaye/choose kare → Product banaye aur category + brand link kare → Product ke variants/SKU/stock/images alag se add kare.**

Category ke bina product save nahi hota, aur brand bhi product ke liye required hai. Category attribute assignment optional hai.

## 1. Admin/staff login

1. Staff admin login page kholta hai: `frontend/src/app/admin/login/page.js`.
2. Frontend admin login API ko call karta hai. Backend ka employee login route `backend/routes/userRoutes.js` mein hai; login controller `backend/controllers/userController.js` mein hai.
3. Login ke baad token/cookie ke zariye admin requests authenticate hoti hain. `backend/middleware/authMiddleware.js` request par employee identity load karta hai.
4. `frontend/src/app/admin/AdminLayoutClient.js` admin area mein session/profile check karta hai.
5. Catalog endpoints par `authMiddleware` ke saath module permission middleware bhi lagta hai. Misal ke taur par categories/products ke liye `products`, attributes ke liye `attribute`, aur brands ke liye `brands` check hota hai.

Permission ka exact result logged-in employee ke saved permission data aur middleware implementation par depend karta hai. Is liye har staff account ko har catalog screen ka access assume na karein.

## 2. Category banana

Category banane ke UI do jagah milte hain:

- Pura category page: `frontend/src/app/admin/categories/page.js`
- Product banate waqt quick-add modal: `frontend/src/components/admin/CategoryFormModal.js`

### Category form mein kya hota hai

Staff category code, name, description, optional parent category, status aur optional attribute assignments bhar sakta hai. Parent select karne se category ka parent/child relation banta hai. Nayi category ke liye code lene ka frontend call `GET /categories/next-code` hai. Category list ke liye admin UI `GET /categories/admin/all` use karta hai.

### Save ke waqt API calls

- Category form: `frontend/src/apis/admin/categoryApi.js`
- Nayi category: `POST /categories`
- Maujooda category edit: `PUT /categories/:id`
- Category delete: `DELETE /categories/:id`
- Category par attributes dekhna: `GET /categories/:categoryId/attributes`
- Category ki attributes update karna: `PUT /categories/:id/attributes`

`backend/routes/categoryRoutes.js` in requests ko authentication aur products permission ke saath route karta hai. `backend/controllers/categoryController.js` ka `createCategory` input validate karke `Category` document banata hai. `assignCategoryAttributes` attribute assignments ko Category par save karta hai.

Category page create request mein attributes bhej sakta hai. Quick-add modal category banane ke baad, agar attributes select hue hon, to unko save karne ke liye alag `PUT /categories/:id/attributes` bhi karta hai. Is liye category creation hamesha do calls nahi hoti: doosri call selected attributes aur UI path par depend karti hai.

### Category database model

`backend/models/Category.js` mein category ka apna code, name, description, status aur translations hote hain. `parent_category_id` isi `Category` model ke doosre document ko point karta hai. Is tarah parent/child category structure banti hai.

Category ka `attributes` array **Attribute documents ki definitions copy nahi karta**; yeh category ke saath un attributes ki assignment/configuration rakhta hai. Assignment mein `attribute_id` (Attribute ka reference), required/visible/filterable/searchable/variant flags, sort order aur value jaisi settings hoti hain.

## 3. Attribute banana ya category ko attribute dena

Attribute ka matlab product/category ki koi property hai, jaise size ya color. Is project mein do alag kaam hain:

1. **Attribute definition banana** — `Attribute` model mein property ka naam/type/options save hote hain.
2. **Attribute ko category se assign karna** — Category ke `attributes` array mein us Attribute ka reference aur us category ke liye settings save hoti hain.

Pehle se bana attribute use karne par frontend `GET /attributes` se available attributes leta hai; category-specific list ke liye `GET /categories/:id/attributes` hai. Naya attribute banane par `POST /attributes` call hoti hai. Attribute ko category ke saath save karna category form ke create/update flow mein hota hai, aam tor par `PUT /categories/:id/attributes` se.

Relevant files:

- UI: `frontend/src/app/admin/categories/page.js`, `frontend/src/components/admin/CategoryFormModal.js`
- API wrapper: `frontend/src/apis/admin/attributeApi.js`, `frontend/src/apis/admin/categoryApi.js`
- Routes: `backend/routes/attributeRoutes.js`, `backend/routes/categoryRoutes.js`
- Controllers: `backend/controllers/attributeController.js`, `backend/controllers/categoryController.js`
- Models: `backend/models/Attribute.js`, `backend/models/Category.js`

`Attribute` document mein naam/code, data type, unit aur `values` options jaisi definition hoti hai. Category assignment mein us attribute ke liye required, storefront visibility, filtering/search aur variant-option jaise flags rakhe ja sakte hain. Attribute ki definition akeli kisi category ko assign nahi hoti; assignment alag save hoti hai.

Attribute endpoints `authMiddleware` aur `checkPermission("attribute")` se protected hain. Category ke andar assignment endpoints category/product permission wale routes par hain. Exact route definitions `backend/routes/attributeRoutes.js` aur `backend/routes/categoryRoutes.js` mein dekhein.

## 4. Brand banana ya choose karna

Product form ke liye brand pehle se maujood ho sakta hai ya staff quick-add brand form se naya brand bana sakta hai. Brand API wrapper `frontend/src/apis/admin/brandApi.js` hai.

- Admin brand list: `GET /brands/admin/all`
- Agla brand code: `GET /brands/next-code`
- Brand banana: `POST /brands` (multipart form, kyun ke logo upload ho sakta hai)
- Brand edit: `PUT /brands/:id`
- Brand delete: `DELETE /brands/:id`

Backend route `backend/routes/brandRoutes.js`, controller `backend/controllers/brandController.js`, aur model `backend/models/brand.js` hain. Brand model code, name, description, logo, country, active status aur translations rakhta hai. Product ke `brand_id` mein is Brand document ka reference save hota hai.

## 5. Product banana

Product form `frontend/src/components/admin/ProductFormModal.js` hai. Form khulte waqt category aur brand lists load hoti hain. Staff existing category/brand choose kar sakta hai ya quick-add modal se bana kar usi product ke liye select kar sakta hai.

Frontend API wrapper: `frontend/src/apis/admin/productApi.js`.

- Products list/read/create ke liye `/products` endpoints use hote hain.
- Naya product: `POST /products`
- Edit: `PUT /products/:id`
- Product detail aur doosre paths ka exact setup `frontend/src/apis/admin/productApi.js` aur `backend/routes/productRoutes.js` mein hai.

Backend route `backend/routes/productRoutes.js` request ko auth, products permission, aur upload/validation middleware se guzarta hai. `backend/controllers/productController.js` data validate karke `Product` model mein save karta hai.

`Product` model (`backend/models/Product.js`) mein product name aur details ke saath required `category_id` aur required `brand_id` references hain. Category se pata chalta hai product kis catalog group mein hai; brand se pata chalta hai product kis brand ka hai.

### Is UI path ki aham had

Current `ProductFormModal` ka create submit base product fields, category, brand, status, tags aur perishability jaisi form values bhejta hai. Is submit mein variant list, variant images ya `specifications` ko append nahi kiya gaya. Backend controller kuch extra product fields accept/validate kar sakta hai, lekin is modal se woh automatically bheje ja rahe hain yeh assume nahi karna chahiye.

## 6. Product variants, price aur stock

Variant product ke andar becha jane wala specific SKU/stock record hai. Product detail/add variant UI `frontend/src/app/admin/products/[id]/page.js`, `frontend/src/app/admin/products/[id]/add-variant/page.js`, aur `frontend/src/components/admin/VariantForm.js` mein hai.

Variant form category ke attributes/hierarchy ko padh sakta hai, taake variant ke options category ke mutabiq dikhaye ja saken. Relevant calls:

- Category attributes hierarchy: `GET /categories/:id/attributes-hierarchy`
- Agla SKU: `GET /variants/next-sku`
- Naya variant: `POST /variants`
- Variant edit: `PUT /variants/:id`
- Variant read/delete: `GET /variants/:id`, `DELETE /variants/:id`

Frontend wrapper `frontend/src/apis/admin/variantApi.js` hai. Backend route/controller `backend/routes/variantRoutes.js` aur `backend/controllers/variantController.js` hain. Create/update routes images ko upload/validate/save karne wale middleware se bhi guzarte hain.

`backend/models/Variant.js` mein `product_id` Product ko reference karta hai. Variant apna SKU/title, cost/selling price, quantity, min/max/top-up stock, mixed `attributes`, tags aur images rakhta hai. Yani product form mein base Product banta hai; SKU/stock/variant details alag Variant record ke taur par add ki jati hain.

## 7. Is flow mein istemal hone wale models

| Staff ka kaam | API | Database model | Link |
| --- | --- | --- | --- |
| Parent/child category banana | `POST /categories` | `Category` | `parent_category_id` doosri Category ko reference karta hai |
| Attribute definition banana | `POST /attributes` | `Attribute` | Baad mein Category assignment mein refer hota hai |
| Attribute category ko dena | `PUT /categories/:id/attributes` | `Category` | `attributes[].attribute_id` → `Attribute` |
| Brand banana | `POST /brands` | `Brand` (`backend/models/brand.js`) | Product isay `brand_id` se refer karta hai |
| Product banana | `POST /products` | `Product` | `category_id` → Category, `brand_id` → Brand |
| SKU/stock variant banana | `POST /variants` | `Variant` | `product_id` → Product |

## 8. Product banane ka poora practical example

1. Staff admin area mein login karta hai.
2. Product form kholta hai. Form categories aur brands mangta hai.
3. Agar required category nahi hai, staff category banata hai. Woh parent category choose kar sakta hai.
4. Category form mein staff existing attributes select kar sakta hai. Naya attribute chahiye to pehle `POST /attributes` hota hai, phir woh attribute category ko assign hota hai.
5. Category save hoti hai: `Category` document. Attribute assignments Category ke andar references/settings hain.
6. Staff brand choose karta hai; zarurat par `POST /brands` se brand banata hai.
7. Product form `POST /products` se product bhejta hai, jis mein category aur brand IDs zaroori hain.
8. Backend `Product` save karta hai aur dono IDs ko references ke taur par rakhta hai.
9. Staff product detail par variant add karta hai. Zarurat par category attribute hierarchy dekhi jati hai.
10. `POST /variants` se SKU, price, quantity, selected variant attributes aur images save hote hain. `Variant.product_id` us Product ko point karta hai.

## 9. Flowchart ke liye key rules

- Category banana aur Attribute definition banana alag operations hain.
- Attribute pehle `Attribute` model mein hota hai; category ke saath uska assignment `Category.attributes` mein hota hai.
- Category par attribute assignment optional hai; product create ke liye category aur brand required hain.
- Category parent/child relation self-reference hai: Category → parent Category.
- Product → Category aur Product → Brand references rakhta hai.
- Product → Variant one-to-many practical relation hai: har Variant ka `product_id` Product ko reference karta hai.
- Base product save aur variant/stock save alag UI/API actions hain.
- ProductFormModal se variants/specifications automatically submit hote hain, yeh current code se confirm nahi hota.

## 10. Main source files

- Category UI: `frontend/src/app/admin/categories/page.js`
- Product form: `frontend/src/components/admin/ProductFormModal.js`
- Product detail: `frontend/src/app/admin/products/[id]/page.js`
- Quick category form: `frontend/src/components/admin/CategoryFormModal.js`
- Variant form: `frontend/src/components/admin/VariantForm.js`
- API wrappers: `frontend/src/apis/admin/categoryApi.js`, `attributeApi.js`, `brandApi.js`, `productApi.js`, `variantApi.js`
- Backend routes: `backend/routes/categoryRoutes.js`, `attributeRoutes.js`, `brandRoutes.js`, `productRoutes.js`, `variantRoutes.js`
- Backend controllers: `backend/controllers/categoryController.js`, `attributeController.js`, `brandController.js`, `productController.js`, `variantController.js`
- Database models: `backend/models/Category.js`, `Attribute.js`, `brand.js`, `Product.js`, `Variant.js`

## Mukhtasar end-to-end samajh

Admin/staff screen par action karta hai. Frontend form values leta hai aur relevant API wrapper se HTTP request bhejta hai. Express route pehle authentication/permission aur zaroori upload middleware chalata hai. Controller input validate karke Mongoose model par create/update karta hai. Database se result response mein frontend ko milta hai; frontend screen/query state refresh karke saved category, attribute, brand, product ya variant dikhata hai.
