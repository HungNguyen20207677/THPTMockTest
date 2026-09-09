import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { issueEssayImageUploadTicket } from "@/lib/services/exam-attempt.service";
import { attemptIdSchema } from "@/lib/validations/exam-attempt";
import {
  essayImageQuestionIdSchema,
  essayImageUploadIntentSchema,
} from "@/lib/validations/essay-image";
import { examIdSchema } from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { EssayImageUploadTicket } from "@/types/exam-attempt";

export const runtime = "nodejs";

interface EssayImageSignatureRouteContext {
  params: Promise<{ examId: string; attemptId: string; questionId: string }>;
}

export async function POST(
  request: Request,
  context: EssayImageSignatureRouteContext,
) {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    const params = await context.params;
    const examId = examIdSchema.parse(params.examId);
    const attemptId = attemptIdSchema.parse(params.attemptId);
    const questionId = essayImageQuestionIdSchema.parse(params.questionId);
    const intent = await parseJsonRequest(
      request,
      essayImageUploadIntentSchema,
    );
    const upload = await issueEssayImageUploadTicket(
      student,
      examId,
      attemptId,
      questionId,
      intent,
    );
    const response = {
      data: { upload },
    } satisfies ApiSuccessResponse<{ upload: EssayImageUploadTicket }>;

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
