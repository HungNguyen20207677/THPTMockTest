import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { importTopics } from "@/lib/services/topic.service";
import { topicImportSchema } from "@/lib/validations/topic";
import type { ApiSuccessResponse } from "@/types/api";
import type { TopicImportResult } from "@/types/topic";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const input = await parseJsonRequest(request, topicImportSchema);
    const result = await importTopics(admin, input);
    const response = { data: { result } } satisfies ApiSuccessResponse<{
      result: TopicImportResult;
    }>;
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
