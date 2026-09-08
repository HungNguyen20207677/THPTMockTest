import type { Metadata } from "next";

import { ExamStructureTemplateManagement } from "@/components/admin/exam-structure-template-management";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Mẫu cấu trúc đề thi",
};

export default async function ExamStructureTemplatesPage() {
  await requirePageRole(USER_ROLE.ADMIN);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ExamStructureTemplateManagement />
    </main>
  );
}
