import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { listAdminResults } from "@/lib/services/reporting.service";
import { adminResultQuerySchema } from "@/lib/validations/reporting";
import type { ApiSuccessResponse } from "@/types/api";
import type { AdminResultList } from "@/types/reporting";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const query = adminResultQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const results = await listAdminResults(admin, query);
    const response = {
      data: results,
    } satisfies ApiSuccessResponse<AdminResultList>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
