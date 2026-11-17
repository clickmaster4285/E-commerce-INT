import SuperAdminShell from "@/components/superadmin/SuperAdminShell";

export const metadata = {
  title: "Super Admin — Click Master Store",
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }) {
  return <SuperAdminShell>{children}</SuperAdminShell>;
}
