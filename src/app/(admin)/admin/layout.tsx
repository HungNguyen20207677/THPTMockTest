import { DashboardNavigation } from "@/components/shared/dashboard-navigation";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requirePageRole(USER_ROLE.ADMIN);

  return (
    <>
      <DashboardNavigation
        user={admin}
        items={[
          { href: "/admin", label: "Tổng quan" },
          { href: "/admin/students", label: "Quản lý học sinh" },
          { href: "/admin/exams", label: "Quản lý đề thi" },
        ]}
      />
      {children}
    </>
  );
}
