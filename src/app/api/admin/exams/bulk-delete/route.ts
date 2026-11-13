import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { bulkDeleteExams } from "@/lib/services/bulk-deletion.service";
import { bulkDeleteExamsSchema } from "@/lib/validations/bulk-deletion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const input = await parseJsonRequest(request, bulkDeleteExamsSchema);
    return NextResponse.json({ data: await bulkDeleteExams(admin, input) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
