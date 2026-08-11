import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { discardUnclaimedExamPdfUpload } from "@/lib/services/exam.service";
import { examPdfUploadReferenceSchema } from "@/lib/validations/exam-pdf";

export const runtime = "nodejs";

export async function DELETE(request: Request): Promise<Response> {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const reference = await parseJsonRequest(
      request,
      examPdfUploadReferenceSchema,
    );
    await discardUnclaimedExamPdfUpload(admin, reference);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
