import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { deleteExam, editExam, getExam } from "@/lib/services/exam.service";
import {
  deleteExamSchema,
  examIdSchema,
  updateExamRequestSchema,
} from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { ExamDetail } from "@/types/exam";

export const runtime = "nodejs";

interface ExamRouteContext {
  params: Promise<{ examId: string }>;
}

export async function GET(_request: Request, context: ExamRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const examId = examIdSchema.parse((await context.params).examId);
    const exam = await getExam(admin, examId);
    const response = {
      data: { exam },
    } satisfies ApiSuccessResponse<{ exam: ExamDetail }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: ExamRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const examId = examIdSchema.parse((await context.params).examId);
    const input = await parseJsonRequest(request, updateExamRequestSchema);
    const exam = await editExam(
      admin,
      examId,
      input.exam,
      input.replacementPdfUpload,
    );
    const response = {
      data: { exam },
    } satisfies ApiSuccessResponse<{ exam: ExamDetail }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: ExamRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const examId = examIdSchema.parse((await context.params).examId);
    const input = await parseJsonRequest(request, deleteExamSchema);
    await deleteExam(admin, examId, input.expectedUpdatedAt);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
