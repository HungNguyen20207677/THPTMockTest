import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AttemptResult } from "@/components/student/attempt-result";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { attemptIdSchema } from "@/lib/validations/exam-attempt";
import { examIdSchema } from "@/lib/validations/exam";

export const metadata: Metadata = {
  title: "Kết quả bài làm",
};

interface StudentAttemptResultPageProps {
  params: Promise<{ examId: string; attemptId: string }>;
}

export default async function StudentAttemptResultPage({
  params,
}: StudentAttemptResultPageProps) {
  await requirePageRole(USER_ROLE.STUDENT);
  const routeParams = await params;
  const parsedExamId = examIdSchema.safeParse(routeParams.examId);
  const parsedAttemptId = attemptIdSchema.safeParse(routeParams.attemptId);

  if (!parsedExamId.success || !parsedAttemptId.success) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <AttemptResult
        examId={parsedExamId.data}
        attemptId={parsedAttemptId.data}
      />
    </main>
  );
}
