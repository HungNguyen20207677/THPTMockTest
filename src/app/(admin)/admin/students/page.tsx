import type { Metadata } from "next";

import { StudentManagement } from "@/components/admin/student-management";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Quản lý học sinh",
};

export default async function StudentsPage() {
  await requirePageRole(USER_ROLE.ADMIN);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <StudentManagement />
    </main>
  );
}
