import { DashboardNavigation } from "@/components/shared/dashboard-navigation";
import { StudentHeaderBoundary } from "@/components/shared/navigation-visibility";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const student = await requirePageRole(USER_ROLE.STUDENT);

  return (
    <StudentHeaderBoundary fallback={children}>
      <DashboardNavigation
        user={student}
        items={[{ href: "/student", label: "Trang chính" }]}
      >
        {children}
      </DashboardNavigation>
    </StudentHeaderBoundary>
  );
}
