import "./super-admin.css";

export const metadata = {
  title: "Super Admin — Click Master Store",
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({ children }) {
  return <div className="super-admin-theme min-h-screen">{children}</div>;
}
