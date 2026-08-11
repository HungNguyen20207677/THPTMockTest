import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExamForm } from "@/components/admin/exam-form";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { examIdSchema } from "@/lib/validations/exam";

export const metadata: Metadata = {
  title: "Chỉnh sửa đề thi",
};

interface EditExamPageProps {
  params: Promise<{ examId: string }>;
}

export default async function EditExamPage({ params }: EditExamPageProps) {
  await requirePageRole(USER_ROLE.ADMIN);
  const parsedExamId = examIdSchema.safeParse((await params).examId);

  if (!parsedExamId.success) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight">Chỉnh sửa đề thi</h1>
        <p className="text-muted-foreground mt-2">
          Cập nhật thông tin, thiết lập và nội dung của đề thi khi được phép.
        </p>
      </div>
      <ExamForm mode="edit" examId={parsedExamId.data} />
    </main>
  );
}
