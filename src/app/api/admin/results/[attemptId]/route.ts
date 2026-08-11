import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { getAdminAttemptDetail } from "@/lib/services/reporting.service";
import { attemptIdSchema } from "@/lib/validations/exam-attempt";
import type { ApiSuccessResponse } from "@/types/api";
import type { AdminAttemptDetail } from "@/types/reporting";

export const runtime = "nodejs";

interface AdminResultRouteContext {
  params: Promise<{ attemptId: string }>;
}

export async function GET(_request: Request, context: AdminResultRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const attemptId = attemptIdSchema.parse((await context.params).attemptId);
    const detail = await getAdminAttemptDetail(admin, attemptId);
    const response = {
      data: { detail },
    } satisfies ApiSuccessResponse<{ detail: AdminAttemptDetail }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
