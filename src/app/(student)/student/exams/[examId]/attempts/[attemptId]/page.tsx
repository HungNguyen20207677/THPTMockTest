import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AttemptWorkspace } from "@/components/student/attempt-workspace";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { attemptIdSchema } from "@/lib/validations/exam-attempt";
import { examIdSchema } from "@/lib/validations/exam";

export const metadata: Metadata = {
  title: "Làm bài thi",
};

interface StudentAttemptPageProps {
  params: Promise<{ examId: string; attemptId: string }>;
}

export default async function StudentAttemptPage({
  params,
}: StudentAttemptPageProps) {
  await requirePageRole(USER_ROLE.STUDENT);
  const routeParams = await params;
  const parsedExamId = examIdSchema.safeParse(routeParams.examId);
  const parsedAttemptId = attemptIdSchema.safeParse(routeParams.attemptId);

  if (!parsedExamId.success || !parsedAttemptId.success) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-[1800px] px-3 py-3 lg:h-[calc(100dvh-8.75rem)] lg:overflow-clip">
      <AttemptWorkspace
        examId={parsedExamId.data}
        attemptId={parsedAttemptId.data}
      />
    </main>
  );
}
