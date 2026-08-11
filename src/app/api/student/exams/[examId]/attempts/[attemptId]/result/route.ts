import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { getStudentExamAttemptResult } from "@/lib/services/exam-attempt.service";
import { attemptIdSchema } from "@/lib/validations/exam-attempt";
import { examIdSchema } from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentExamAttemptResult } from "@/types/exam-attempt";

export const runtime = "nodejs";

interface AttemptResultRouteContext {
  params: Promise<{ examId: string; attemptId: string }>;
}

export async function GET(
  _request: Request,
  context: AttemptResultRouteContext,
) {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    const params = await context.params;
    const examId = examIdSchema.parse(params.examId);
    const attemptId = attemptIdSchema.parse(params.attemptId);
    const result = await getStudentExamAttemptResult(
      student,
      examId,
      attemptId,
    );
    const response = {
      data: { result },
    } satisfies ApiSuccessResponse<{ result: StudentExamAttemptResult }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
