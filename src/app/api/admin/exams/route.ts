import { NextResponse } from "next/server";

import { parseExamMultipartRequest } from "@/lib/api/exam-request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { createExam, listExams } from "@/lib/services/exam.service";
import { examUpsertSchema } from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { ExamDetail, ExamSummary } from "@/types/exam";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const exams = await listExams(admin);
    const response = {
      data: { exams },
    } satisfies ApiSuccessResponse<{ exams: ExamSummary[] }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const { input, pdf } = await parseExamMultipartRequest(
      request,
      examUpsertSchema,
      true,
    );
    const exam = await createExam(admin, input, pdf);
    const response = {
      data: { exam },
    } satisfies ApiSuccessResponse<{ exam: ExamDetail }>;

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
