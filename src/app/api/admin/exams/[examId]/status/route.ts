import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { changeExamStatus } from "@/lib/services/exam.service";
import { examIdSchema, updateExamStatusSchema } from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { ExamDetail } from "@/types/exam";

export const runtime = "nodejs";

interface ExamStatusRouteContext {
  params: Promise<{ examId: string }>;
}

export async function PATCH(request: Request, context: ExamStatusRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const examId = examIdSchema.parse((await context.params).examId);
    const input = await parseJsonRequest(request, updateExamStatusSchema);
    const exam = await changeExamStatus(
      admin,
      examId,
      input.status,
      input.expectedUpdatedAt,
    );
    const response = {
      data: { exam },
    } satisfies ApiSuccessResponse<{ exam: ExamDetail }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
