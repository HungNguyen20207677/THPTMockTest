import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { getStudentExamAttemptHistory } from "@/lib/services/reporting.service";
import { examIdSchema } from "@/lib/validations/exam";
import { paginationQuerySchema } from "@/lib/validations/reporting";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentExamAttemptHistory } from "@/types/reporting";

export const runtime = "nodejs";

interface StudentExamHistoryRouteContext {
  params: Promise<{ examId: string }>;
}

export async function GET(
  request: Request,
  context: StudentExamHistoryRouteContext,
) {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    const examId = examIdSchema.parse((await context.params).examId);
    const query = paginationQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const history = await getStudentExamAttemptHistory(student, examId, query);
    const response = {
      data: { history },
    } satisfies ApiSuccessResponse<{ history: StudentExamAttemptHistory }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
