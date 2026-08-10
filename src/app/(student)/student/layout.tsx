import { DashboardNavigation } from "@/components/shared/dashboard-navigation";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const student = await requirePageRole(USER_ROLE.STUDENT);

  return (
    <>
      <DashboardNavigation
        user={student}
        items={[{ href: "/student", label: "Trang chính" }]}
      />
      {children}
    </>
  );
}
