import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/route-error";
import { discardUnclaimedExamPdfUpload } from "@/lib/services/exam.service";
import { examPdfUploadReferenceSchema } from "@/lib/validations/exam-pdf";

export const runtime = "nodejs";

export async function DELETE(request: Request): Promise<Response> {
  try {
    const reference = examPdfUploadReferenceSchema.parse(await request.json());
    await discardUnclaimedExamPdfUpload(reference);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
