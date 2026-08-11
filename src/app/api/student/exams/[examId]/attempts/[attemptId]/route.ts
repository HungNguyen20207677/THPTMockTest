import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { getOwnedExamAttemptContext } from "@/lib/services/exam-attempt.service";
import { attemptIdSchema } from "@/lib/validations/exam-attempt";
import { examIdSchema } from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentExamAttemptContext } from "@/types/exam-attempt";

export const runtime = "nodejs";

interface StudentExamAttemptRouteContext {
  params: Promise<{ examId: string; attemptId: string }>;
}

export async function GET(
  _request: Request,
  context: StudentExamAttemptRouteContext,
) {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    const params = await context.params;
    const examId = examIdSchema.parse(params.examId);
    const attemptId = attemptIdSchema.parse(params.attemptId);
    const attemptContext = await getOwnedExamAttemptContext(
      student,
      examId,
      attemptId,
    );
    const response = {
      data: { context: attemptContext },
    } satisfies ApiSuccessResponse<{ context: StudentExamAttemptContext }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
