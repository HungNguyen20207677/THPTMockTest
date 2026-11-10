import { DashboardNavigation } from "@/components/shared/dashboard-navigation";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requirePageRole(USER_ROLE.ADMIN);

  return (
    <DashboardNavigation
      user={admin}
      items={[
        { href: "/admin", label: "Tổng quan", icon: "layout-dashboard" },
        {
          href: "/admin/students",
          label: "Quản lý học sinh",
          icon: "users",
        },
        {
          href: "/admin/exams",
          label: "Quản lý đề thi",
          icon: "file-text",
        },
        {
          href: "/admin/topics",
          label: "Chủ đề & kiến thức",
          icon: "book-open",
        },
        {
          href: "/admin/exam-structure-templates",
          label: "Mẫu cấu trúc",
          icon: "layout-template",
        },
        { href: "/admin/results", label: "Kết quả", icon: "clipboard-check" },
      ]}
    >
      {children}
    </DashboardNavigation>
  );
}
