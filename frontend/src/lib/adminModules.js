/**
 * Single source of truth for admin store modules.
 * Sidebar nav + Super Admin Plans (limits) both map from this list.
 *
 * countable → plan form pe max-limit number dikhe
 */
import {
  FolderOpen,
  Tag,
  Package,
  LayoutDashboard,
  Store,
  User,
  Users,
  Gift,
  Image as ImageIcon,
  ShoppingCart,
  Truck,
  Percent,
  Boxes,
  Star,
  SlidersHorizontal,
  MessageSquareText,
  MessageCircle,
  ContactRound,
  FileText,
  Receipt,
  DollarSign,
  Paintbrush,
  Files,
  Mail,
} from "lucide-react";

/** Section order — sidebarTitle uppercase labels i18n keys ke liye */
export const ADMIN_SECTIONS = [
  { id: "overview", title: "Overview", sidebarTitle: "OVERVIEW" },
  { id: "catalog", title: "Catalog", sidebarTitle: "CATALOG" },
  { id: "sales", title: "Sales & Marketing", sidebarTitle: "SALES & MARKETING" },
  { id: "operations", title: "Operations", sidebarTitle: "OPERATIONS" },
  { id: "purchasing", title: "Purchasing", sidebarTitle: "PURCHASING" },
  {
    id: "pos",
    title: "POS & Customers",
    sidebarTitle: "POS & CUSTOMER MANAGEMENT",
    hideSidebarHeading: true,
  },
  { id: "finance", title: "Finance", sidebarTitle: "FINANCE" },
  { id: "store", title: "Store", sidebarTitle: "STORE" },
  { id: "team", title: "Team", sidebarTitle: "TEAM & ACCOUNT" },
];

export const ADMIN_MODULES = [
  { key: "dashboard", name: "Dashboard", section: "overview", path: "/admin/dashboard", permissionKey: "dashboard", icon: LayoutDashboard, countable: false, nav: true },
  { key: "brands", name: "Brands", section: "catalog", path: "/admin/brands", permissionKey: "brands", icon: Tag, countable: true, nav: true },
  { key: "categories", name: "Categories", section: "catalog", path: "/admin/categories", permissionKey: "categories", icon: FolderOpen, countable: true, nav: true },
  { key: "attributes", name: "Attributes", section: "catalog", path: "/admin/attributes", permissionKey: "attribute", icon: SlidersHorizontal, countable: true, nav: true },
  { key: "products", name: "Products", section: "catalog", path: "/admin/products", permissionKey: "products", icon: Package, countable: true, nav: true },
  { key: "featuredProducts", name: "Featured Products", section: "catalog", path: "/admin/featured-products", permissionKey: "featuredProducts", fallbackKey: "products", icon: Star, countable: true, nav: true },
  { key: "reviews", name: "Reviews", section: "catalog", path: "/admin/reviews", permissionKey: "reviews", fallbackKey: "products", icon: MessageSquareText, countable: true, nav: true },
  { key: "discounts", name: "Discounts", section: "sales", path: "/admin/discounts", permissionKey: "discounts", icon: Percent, countable: true, nav: true },
  { key: "deals", name: "Deals", section: "sales", path: "/admin/deals", permissionKey: "deals", icon: Gift, countable: true, nav: true },
  { key: "banners", name: "Banners", section: "sales", path: "/admin/banners", permissionKey: "banners", icon: ImageIcon, countable: true, nav: true },
  { key: "manageStock", name: "Manage Stock", section: "operations", path: "/admin/manage-stock", permissionKey: "manageStock", icon: Boxes, countable: false, nav: true },
  { key: "orders", name: "Orders", section: "operations", path: "/admin/orders", permissionKey: "order", icon: ShoppingCart, countable: true, nav: true },
  { key: "chats", name: "Chats", section: "operations", path: "/admin/chats", permissionKey: "order", icon: MessageCircle, countable: true, nav: true },
  { key: "shipping", name: "Shipping", section: "operations", path: "/admin/shipping", permissionKey: "shipping", icon: Truck, countable: false, nav: true },
  { key: "vendors", name: "Vendors", section: "purchasing", path: "/admin/vendors", permissionKey: "vendors", icon: Users, countable: true, nav: true },
  { key: "purchaseOrders", name: "Purchase Orders", section: "purchasing", path: "/admin/purchase-orders", permissionKey: "purchaseOrders", icon: Package, countable: true, nav: true },
  { key: "pos", name: "POS", section: "pos", path: "/admin/pos", permissionKey: "pos", icon: ShoppingCart, countable: false, nav: true },
  { key: "customers", name: "Customers", section: "pos", path: "/admin/customers", permissionKey: "customers", icon: Users, countable: true, nav: true },
  { key: "subscribers", name: "Subscribers", section: "pos", path: "/admin/subscribers", permissionKey: "customers", icon: Mail, countable: false, nav: true },
  { key: "leads", name: "Leads", section: "pos", path: "/admin/leads", permissionKey: "leads", icon: ContactRound, countable: true, nav: true },
  { key: "quotes", name: "Quotes", section: "pos", path: "/admin/quotes", permissionKey: "quotes", icon: FileText, countable: true, nav: true },
  { key: "invoices", name: "Invoices", section: "pos", path: "/admin/invoices", permissionKey: "invoices", fallbackKey: "quotes", icon: Receipt, countable: true, nav: true },
  { key: "finance", name: "Finance", section: "finance", path: "/admin/finance", permissionKey: "finance", icon: DollarSign, countable: false, nav: true },
  { key: "storeInfo", name: "Store Info", section: "store", path: "/admin/store-info", permissionKey: "store", icon: Store, countable: false, nav: true },
  { key: "terms", name: "Terms & Conditions", section: "store", path: "/admin/terms-conditions", permissionKey: "store", icon: FileText, countable: false, nav: true },
  { key: "storeEditor", name: "Store Editor", section: "store", path: "/admin/store-editor", permissionKey: "storeEditor", fallbackKey: "store", icon: Paintbrush, countable: false, nav: true },
  { key: "pages", name: "Pages", section: "store", path: "/admin/pages", permissionKey: "storeEditor", fallbackKey: "store", icon: Files, countable: false, nav: true },
  { key: "employees", name: "Employees", section: "team", path: "/admin/employees", permissionKey: "employees", icon: Users, countable: true, nav: true },
  { key: "profile", name: "Profile", section: "team", path: "/admin/profile", permissionKey: "profile", icon: User, countable: false, nav: true },
];

export const getSection = (sectionId) => ADMIN_SECTIONS.find((s) => s.id === sectionId);

/** Sidebar: sections that have at least one nav module */
export const getSidebarSections = () =>
  ADMIN_SECTIONS.filter((s) => s.nav !== false).map((s) => ({
    ...s,
    items: ADMIN_MODULES.filter((m) => m.nav !== false && m.section === s.id).map((m) => m.name),
  }));

/** Sidebar menu rows (path + icon + permission) */
export const getNavModules = () =>
  ADMIN_MODULES.filter((m) => m.nav !== false).map((m) => ({
    key: m.key,
    name: m.name,
    path: m.path,
    permissionKey: m.permissionKey,
    fallbackKey: m.fallbackKey,
    icon: m.icon,
    section: m.section,
  }));

/** Plans UI: every module (incl. plan-only), with section title for tabs */
export const getPlanModules = () =>
  ADMIN_MODULES.map((m) => ({
    key: m.key,
    label: m.key === "employees" ? "Employees / Staff" : m.name,
    name: m.name,
    section: getSection(m.section)?.title || m.section,
    sectionId: m.section,
    countable: Boolean(m.countable),
    icon: m.icon,
    nav: m.nav !== false,
  }));

export const getPlanSections = () => {
  const used = new Set(ADMIN_MODULES.map((m) => m.section));
  return ADMIN_SECTIONS.filter((s) => used.has(s.id)).map((s) => s.title);
};
