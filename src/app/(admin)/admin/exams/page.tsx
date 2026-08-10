import type { Metadata } from "next";

import { ExamManagement } from "@/components/admin/exam-management";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Quản lý đề thi",
};

export default async function ExamsPage() {
  await requirePageRole(USER_ROLE.ADMIN);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ExamManagement />
    </main>
  );
}
