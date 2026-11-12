import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { getAdminExamAssignmentCompletion } from "@/lib/services/reporting.service";
import { examIdSchema } from "@/lib/validations/exam";
import { paginationQuerySchema } from "@/lib/validations/reporting";
import type { ApiSuccessResponse } from "@/types/api";
import type { AdminExamAssignmentCompletionPage } from "@/types/reporting";

export const runtime = "nodejs";

interface AdminExamCompletionsRouteContext {
  params: Promise<{ examId: string }>;
}

export async function GET(
  request: Request,
  context: AdminExamCompletionsRouteContext,
) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const examId = examIdSchema.parse((await context.params).examId);
    const query = paginationQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const report = await getAdminExamAssignmentCompletion(admin, examId, query);
    const response = {
      data: { report },
    } satisfies ApiSuccessResponse<{
      report: AdminExamAssignmentCompletionPage;
    }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
