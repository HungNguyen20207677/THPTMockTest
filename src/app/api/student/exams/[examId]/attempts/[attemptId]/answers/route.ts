import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { saveExamAttemptAnswers } from "@/lib/services/exam-attempt.service";
import { attemptAnswersRequestSchema } from "@/lib/validations/attempt-answers";
import { attemptIdSchema } from "@/lib/validations/exam-attempt";
import { examIdSchema } from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentExamAttemptMutationResult } from "@/types/exam-attempt";

export const runtime = "nodejs";

interface AttemptAnswersRouteContext {
  params: Promise<{ examId: string; attemptId: string }>;
}

export async function PATCH(
  request: Request,
  context: AttemptAnswersRouteContext,
) {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    const params = await context.params;
    const examId = examIdSchema.parse(params.examId);
    const attemptId = attemptIdSchema.parse(params.attemptId);
    const input = await parseJsonRequest(request, attemptAnswersRequestSchema);
    const result = await saveExamAttemptAnswers(
      student,
      examId,
      attemptId,
      input.answers,
    );
    const response = {
      data: result,
    } satisfies ApiSuccessResponse<StudentExamAttemptMutationResult>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
