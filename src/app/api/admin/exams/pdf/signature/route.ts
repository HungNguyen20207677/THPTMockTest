import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { issueExamPdfUploadTicket } from "@/lib/services/exam.service";
import { examPdfUploadIntentSchema } from "@/lib/validations/exam-pdf";
import type { ApiSuccessResponse } from "@/types/api";
import type { ExamPdfUploadTicket } from "@/types/exam";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const input = await parseJsonRequest(request, examPdfUploadIntentSchema);
    const upload = issueExamPdfUploadTicket(admin, input);
    const response = {
      data: { upload },
    } satisfies ApiSuccessResponse<{ upload: ExamPdfUploadTicket }>;

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
