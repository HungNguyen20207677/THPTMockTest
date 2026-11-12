import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { bulkDeleteTopics } from "@/lib/services/topic.service";
import { bulkDeleteTopicsSchema } from "@/lib/validations/topic";
import type { ApiSuccessResponse } from "@/types/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const input = await parseJsonRequest(request, bulkDeleteTopicsSchema);
    const result = await bulkDeleteTopics(admin, input);
    const response = { data: result } satisfies ApiSuccessResponse<{
      deletedCount: number;
    }>;
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
