import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { startOrResumeExamAttempt } from "@/lib/services/exam-attempt.service";
import { emptyAttemptMutationSchema } from "@/lib/validations/exam-attempt";
import { examIdSchema } from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentExamAttemptContext } from "@/types/exam-attempt";

export const runtime = "nodejs";

interface StudentExamAttemptsRouteContext {
  params: Promise<{ examId: string }>;
}

export async function POST(
  request: Request,
  context: StudentExamAttemptsRouteContext,
) {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    await parseJsonRequest(request, emptyAttemptMutationSchema);
    const examId = examIdSchema.parse((await context.params).examId);
    const attemptContext = await startOrResumeExamAttempt(student, examId);
    const response = {
      data: { context: attemptContext },
    } satisfies ApiSuccessResponse<{ context: StudentExamAttemptContext }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
