import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { getAdminDashboardSummary } from "@/lib/services/reporting.service";
import type { ApiSuccessResponse } from "@/types/api";
import type { AdminDashboardSummary } from "@/types/reporting";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const summary = await getAdminDashboardSummary(admin);
    const response = {
      data: { summary },
    } satisfies ApiSuccessResponse<{ summary: AdminDashboardSummary }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
