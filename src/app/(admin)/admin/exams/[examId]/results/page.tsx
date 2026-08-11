import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminExamResultsView } from "@/components/admin/exam-results";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { examIdSchema } from "@/lib/validations/exam";

export const metadata: Metadata = {
  title: "Thống kê đề thi",
};

export default async function AdminExamResultsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  await requirePageRole(USER_ROLE.ADMIN);
  const parsedExamId = examIdSchema.safeParse((await params).examId);

  if (!parsedExamId.success) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <AdminExamResultsView examId={parsedExamId.data} />
    </main>
  );
}
