import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudentAttemptHistory } from "@/components/student/attempt-history";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { examIdSchema } from "@/lib/validations/exam";

export const metadata: Metadata = {
  title: "Lịch sử làm bài",
};

export default async function StudentExamHistoryPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  await requirePageRole(USER_ROLE.STUDENT);
  const parsedExamId = examIdSchema.safeParse((await params).examId);

  if (!parsedExamId.success) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <StudentAttemptHistory examId={parsedExamId.data} />
    </main>
  );
}
