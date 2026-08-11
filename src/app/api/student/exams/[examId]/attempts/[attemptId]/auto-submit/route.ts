import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { finalizeExpiredExamAttempt } from "@/lib/services/exam-attempt.service";
import {
  attemptIdSchema,
  emptyAttemptMutationSchema,
} from "@/lib/validations/exam-attempt";
import { examIdSchema } from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentExamAttemptMutationResult } from "@/types/exam-attempt";

export const runtime = "nodejs";

interface AutoSubmitAttemptRouteContext {
  params: Promise<{ examId: string; attemptId: string }>;
}

export async function POST(
  request: Request,
  context: AutoSubmitAttemptRouteContext,
) {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    await parseJsonRequest(request, emptyAttemptMutationSchema);
    const params = await context.params;
    const examId = examIdSchema.parse(params.examId);
    const attemptId = attemptIdSchema.parse(params.attemptId);
    const result = await finalizeExpiredExamAttempt(student, examId, attemptId);
    const response = {
      data: result,
    } satisfies ApiSuccessResponse<StudentExamAttemptMutationResult>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
