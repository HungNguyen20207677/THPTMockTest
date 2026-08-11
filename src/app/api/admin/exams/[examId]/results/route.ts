import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { getAdminExamResults } from "@/lib/services/reporting.service";
import { examIdSchema } from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { AdminExamResults } from "@/types/reporting";

export const runtime = "nodejs";

interface AdminExamResultsRouteContext {
  params: Promise<{ examId: string }>;
}

export async function GET(
  _request: Request,
  context: AdminExamResultsRouteContext,
) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const examId = examIdSchema.parse((await context.params).examId);
    const report = await getAdminExamResults(admin, examId);
    const response = {
      data: { report },
    } satisfies ApiSuccessResponse<{ report: AdminExamResults }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
