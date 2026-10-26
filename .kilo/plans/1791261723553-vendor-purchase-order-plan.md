# Vendor & Purchase Order Feature Plan

## Overview
Add vendor management and purchase order functionality to the existing e-commerce admin panel. This enables admins to manage suppliers (vendors) and create/track purchase orders for inventory replenishment.

---

## Current Architecture Analysis

### Backend (Node.js/Express/MongoDB)
- **Models**: `Order`, `Product`, `Variant`, `Employee`, `Category`, `Brand`, etc.
- **Routes**: RESTful under `/api/` prefix with permission middleware (`checkPermission`)
- **Controllers**: Thin controllers with business logic
- **Permissions**: Role-based (admin bypass) + granular permissions per feature
- **Real-time**: Socket.io for live updates (stock, orders, permissions)

### Frontend (Next.js 14/React/Redux/TanStack Query)
- **Admin Layout**: `layout.js` with sidebar, navbar, permission guards
- **Sidebar**: `Sidebar.js` with section grouping, permission-filtered menu items
- **Pages**: Table/card views with search, filters, pagination, bulk actions
- **API**: `adminHttp` axios instance + feature-specific API files (`orderApi.js`, `brandApi.js`)
- **Real-time**: Socket sync hooks (`useOrderSocketSync`, `useBrandSocketSync`)

---

## Feature Requirements

### 1. Vendor Management
- CRUD operations for vendors
- Vendor fields: name, contact person, email, phone, address, payment terms, notes, status
- Link vendors to products/variants (optional - for quick PO creation)

### 2. Purchase Order Management
- Create POs from vendors
- PO statuses: `draft`, `pending`, `confirmed`, `received`, `cancelled`
- PO items linked to variants with expected quantities/costs
- Receive PO → increment variant stock automatically
- Link received items to existing stock history

### 3. Admin Panel Integration
- New sidebar section: "PROCUREMENT"
- New menu items: "Vendors", "Purchase Orders"
- New permission keys: `vendors`, `purchaseOrders`

---

## Implementation Plan

### Phase 1: Backend - Models & Database

#### 1.1 Create Vendor Model (`backend/models/Vendor.js`)
```javascript
// Fields:
// - name (required, unique)
// - contact_person
// - email (unique, sparse)
// - phone
// - address: { street, city, state, zip, country }
// - payment_terms (e.g., "Net 30", "COD", "Advance")
// - tax_number (GST/VAT)
// - notes
// - status: active/inactive
// - createdby, updatedby, deletedby (Employee refs)
// - timestamps
```

#### 1.2 Create PurchaseOrder Model (`backend/models/PurchaseOrder.js`)
```javascript
// Fields:
// - po_number (unique, auto-generated: PO-00001)
// - vendor_id (ref Vendor, required)
// - items: [{
//     variant_id (ref Variant, required),
//     product_id (ref Product, denormalized),
//     name, sku, variant_title (denormalized),
//     expected_qty, received_qty (default 0),
//     cost_price, total_cost (cost_price * expected_qty)
//   }]
// - subtotal, tax, shipping, total
// - status: draft/pending/confirmed/received/cancelled
// - expected_date, received_date
// - notes, cancel_reason
// - createdby, updatedby, receivedby (Employee refs)
// - timestamps
```

#### 1.3 Add Indexes
- Vendor: name, email, status
- PurchaseOrder: vendor_id, status, po_number, created_at

### Phase 2: Backend - Controllers & Routes

#### 2.1 Vendor Controller (`backend/controllers/vendorController.js`)
- `getAllVendors` - paginated, search, filter by status
- `getVendorById`
- `createVendor` (permission: vendors)
- `updateVendor` (permission: vendors)
- `deleteVendor` / `toggleStatus` (permission: vendors)

#### 2.2 Purchase Order Controller (`backend/controllers/purchaseOrderController.js`)
- `getAllPOs` - paginated, search, filter by status/vendor
- `getPOById`
- `createPO` (permission: purchaseOrders) - creates in `draft` status
- `updatePO` (permission: purchaseOrders) - only draft/pending editable
- `confirmPO` - status: draft → pending (permission: purchaseOrders)
- `receivePO` - status: confirmed/pending → received, increments variant stock (permission: purchaseOrders)
- `cancelPO` (permission: purchaseOrders)
- `deletePO` - only draft (permission: purchaseOrders)

#### 2.3 Routes
- `backend/routes/vendorRoutes.js` → `/api/vendors`
- `backend/routes/purchaseOrderRoutes.js` → `/api/purchase-orders`
- Register in `server.js`

### Phase 3: Backend - Permissions & Socket Events

#### 3.1 Permissions
- Add `vendors` and `purchaseOrders` to:
  - Employee seed permissions (server.js)
  - `ROUTE_PERMISSIONS` in `frontend/src/app/admin/layout.js`
  - `allMenuItems` in `frontend/src/components/adminComponents/Sidebar.js`

#### 3.2 Socket Events
- `vendorCreated`, `vendorUpdated`, `vendorDeleted`
- `poCreated`, `poUpdated`, `poStatusChanged`, `poReceived`
- Emit on stock changes from PO receipt for `manage-stock` page sync

### Phase 4: Frontend - Admin API Layer

#### 4.1 `frontend/src/apis/admin/vendorApi.js`
```javascript
getAll: (params) => adminHttp.get("/vendors", { params }).then(r => r.data),
getById: (id) => adminHttp.get(`/vendors/${id}`).then(r => r.data),
create: (data) => adminHttp.post("/vendors", data).then(r => r.data),
update: (id, data) => adminHttp.put(`/vendors/${id}`, data).then(r => r.data),
delete: (id) => adminHttp.delete(`/vendors/${id}`).then(r => r.data),
toggleStatus: (id) => adminHttp.patch(`/vendors/${id}/toggle-status`).then(r => r.data),
```

#### 4.2 `frontend/src/apis/admin/purchaseOrderApi.js`
```javascript
getAll: (params) => adminHttp.get("/purchase-orders", { params }).then(r => r.data),
getById: (id) => adminHttp.get(`/purchase-orders/${id}`).then(r => r.data),
create: (data) => adminHttp.post("/purchase-orders", data).then(r => r.data),
update: (id, data) => adminHttp.put(`/purchase-orders/${id}`, data).then(r => r.data),
confirm: (id) => adminHttp.patch(`/purchase-orders/${id}/confirm`).then(r => r.data),
receive: (id, data) => adminHttp.patch(`/purchase-orders/${id}/receive`, data).then(r => r.data),
cancel: (id, reason) => adminHttp.patch(`/purchase-orders/${id}/cancel`, { cancel_reason: reason }).then(r => r.data),
delete: (id) => adminHttp.delete(`/purchase-orders/${id}`).then(r => r.data),
```

### Phase 5: Frontend - Socket Sync Hooks

#### 5.1 `frontend/src/hooks/useVendorSocketSync.js`
- Listen: `vendorCreated`, `vendorUpdated`, `vendorDeleted`
- Invalidate vendor queries

#### 5.2 `frontend/src/hooks/usePurchaseOrderSocketSync.js`
- Listen: `poCreated`, `poUpdated`, `poStatusChanged`, `poReceived`
- Invalidate PO queries
- On `poReceived`, also trigger stock sync

#### 5.3 Register in `layout.js` (like other socket hooks)

### Phase 6: Frontend - Admin Pages

#### 6.1 Vendors Page (`frontend/src/app/admin/vendors/page.js`)
- Follow `brands/page.js` pattern
- Table with: Logo/Name, Contact Person, Email, Phone, Status, Actions
- Modal for Create/Edit with form validation
- Search, status filter, pagination
- Bulk actions: activate/deactivate/delete

#### 6.2 Vendor Detail Page (`frontend/src/app/admin/vendors/[id]/page.js`)
- Vendor info + associated POs list
- Quick create PO button

#### 6.3 Purchase Orders Page (`frontend/src/app/admin/purchase-orders/page.js`)
- Follow `orders/page.js` pattern
- Table with: PO#, Vendor, Status, Total, Expected Date, Actions
- Status badges (draft/pending/confirmed/received/cancelled)
- Search, status filter, vendor filter, date range
- Bulk actions: confirm, cancel

#### 6.4 PO Detail Page (`frontend/src/app/admin/purchase-orders/[id]/page.js`)
- Header: PO#, Vendor, Status, Dates, Total
- Items table: Variant, Expected, Received, Cost, Total
- Actions based on status:
  - Draft: Edit, Confirm, Delete
  - Pending: Edit, Confirm, Cancel
  - Confirmed: Receive, Cancel
  - Received: View only
  - Cancelled: View only
- Receive modal: per-item received qty input, auto-calc

### Phase 7: Sidebar & Navigation Updates

#### 7.1 `Sidebar.js`
- Add "PROCUREMENT" section
- Add menu items:
  - Vendors (icon: Users/Building2, permission: vendors)
  - Purchase Orders (icon: ShoppingBag/ClipboardList, permission: purchaseOrders)

#### 7.2 `layout.js`
- Add to `ROUTE_PERMISSIONS`:
  - `/admin/vendors`: 'vendors'
  - `/admin/vendors/:id`: 'vendors'
  - `/admin/purchase-orders`: 'purchaseOrders'
  - `/admin/purchase-orders/:id`: 'purchaseOrders'

### Phase 8: Stock Integration

#### 8.1 On PO Receive
- For each item: `Variant.updateOne({ _id: variant_id }, { $inc: { quantity: received_qty } })`
- Create StockHistory entry (type: 'purchase_order', reference: PO#)
- Emit `stockUpdated` socket event for manage-stock page

---

## Data Flow Summary

```
Admin creates PO (draft)
    ↓
Admin confirms PO → status: pending
    ↓
Vendor delivers goods
    ↓
Admin receives PO → for each item:
    1. Update PO item received_qty
    2. Variant.quantity += received_qty
    3. Create StockHistory record
    4. Emit stockUpdated socket
    ↓
PO status → received
Manage-stock page auto-refreshes
```

---

## Edge Cases & Validations

1. **PO Receive Validation**: received_qty ≤ (expected_qty - already_received)
2. **Partial Receipts**: Allow multiple receive operations until fully received
3. **Cost Price Updates**: Option to update variant cost_price on receive
4. **Duplicate PO Numbers**: Handle race condition with retry loop
5. **Vendor Deletion**: Prevent if linked POs exist (soft delete or block)
6. **Variant Deletion**: Prevent if in active PO (or handle gracefully)

---

## Testing Checklist

- [ ] Vendor CRUD with permissions
- [ ] PO full lifecycle: draft → pending → confirmed → received
- [ ] Stock increments correctly on receive
- [ ] Stock history records created
- [ ] Socket events fire correctly
- [ ] Sidebar permissions work for non-admin users
- [ ] Mobile responsive tables
- [ ] Search/filter/pagination works
- [ ] Bulk actions work

---

## Out of Scope (Future Enhancements)

- PO approval workflow (multi-level)
- Vendor portal / email notifications
- Purchase order PDF generation
- Supplier performance analytics
- Automated reorder points
- Multi-currency support
- PO templates/recurring orders

---

## File Creation Summary

### Backend (New Files)
1. `backend/models/Vendor.js`
2. `backend/models/PurchaseOrder.js`
3. `backend/controllers/vendorController.js`
4. `backend/controllers/purchaseOrderController.js`
5. `backend/routes/vendorRoutes.js`
6. `backend/routes/purchaseOrderRoutes.js`

### Backend (Modified)
7. `backend/server.js` - register routes

### Frontend (New Files)
8. `frontend/src/apis/admin/vendorApi.js`
9. `frontend/src/apis/admin/purchaseOrderApi.js`
10. `frontend/src/hooks/useVendorSocketSync.js`
11. `frontend/src/hooks/usePurchaseOrderSocketSync.js`
12. `frontend/src/app/admin/vendors/page.js`
13. `frontend/src/app/admin/vendors/[id]/page.js`
14. `frontend/src/app/admin/purchase-orders/page.js`
15. `frontend/src/app/admin/purchase-orders/[id]/page.js`

### Frontend (Modified)
16. `frontend/src/components/adminComponents/Sidebar.js` - add menu items
17. `frontend/src/app/admin/layout.js` - add route permissions
18. `backend/utils/socket.js` - add event constants (if needed)

---

## Estimated Implementation Order

1. Models → Controllers → Routes → Server registration
2. Frontend API → Socket hooks → Pages
3. Sidebar/Layout integration
4. Testing & refinement