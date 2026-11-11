import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { issueSolutionPdfUploadTicket } from "@/lib/services/exam.service";
import { examPdfUploadIntentSchema } from "@/lib/validations/exam-pdf";
import type { ApiSuccessResponse } from "@/types/api";
import type { SolutionPdfUploadTicket } from "@/types/exam";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const input = await parseJsonRequest(request, examPdfUploadIntentSchema);
    const upload = issueSolutionPdfUploadTicket(admin, input);
    return NextResponse.json(
      { data: { upload } } satisfies ApiSuccessResponse<{
        upload: SolutionPdfUploadTicket;
      }>,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
