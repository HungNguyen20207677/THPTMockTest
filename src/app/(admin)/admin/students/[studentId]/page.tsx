import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminStudentDetailView } from "@/components/admin/student-detail";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { studentIdSchema } from "@/lib/validations/user";

export const metadata: Metadata = {
  title: "Kết quả học sinh",
};

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requirePageRole(USER_ROLE.ADMIN);
  const parsedStudentId = studentIdSchema.safeParse((await params).studentId);

  if (!parsedStudentId.success) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <AdminStudentDetailView studentId={parsedStudentId.data} />
    </main>
  );
}
