import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  attachEssayImage,
  removeEssayImage,
} from "@/lib/services/exam-attempt.service";
import { attemptIdSchema } from "@/lib/validations/exam-attempt";
import {
  attachEssayImageRequestSchema,
  essayImageQuestionIdSchema,
  removeEssayImageRequestSchema,
} from "@/lib/validations/essay-image";
import { examIdSchema } from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentExamAttemptMutationResult } from "@/types/exam-attempt";

export const runtime = "nodejs";

interface EssayImageRouteContext {
  params: Promise<{ examId: string; attemptId: string; questionId: string }>;
}

async function parseRouteParams(context: EssayImageRouteContext) {
  const params = await context.params;
  return {
    examId: examIdSchema.parse(params.examId),
    attemptId: attemptIdSchema.parse(params.attemptId),
    questionId: essayImageQuestionIdSchema.parse(params.questionId),
  };
}

export async function POST(request: Request, context: EssayImageRouteContext) {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    const { examId, attemptId, questionId } = await parseRouteParams(context);
    const input = await parseJsonRequest(
      request,
      attachEssayImageRequestSchema,
    );
    const result = await attachEssayImage(
      student,
      examId,
      attemptId,
      questionId,
      input.upload,
    );
    const response = {
      data: result,
    } satisfies ApiSuccessResponse<StudentExamAttemptMutationResult>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: EssayImageRouteContext,
) {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    const { examId, attemptId, questionId } = await parseRouteParams(context);
    const input = await parseJsonRequest(
      request,
      removeEssayImageRequestSchema,
    );
    const result = await removeEssayImage(
      student,
      examId,
      attemptId,
      questionId,
      input.publicId,
    );
    const response = {
      data: result,
    } satisfies ApiSuccessResponse<StudentExamAttemptMutationResult>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
