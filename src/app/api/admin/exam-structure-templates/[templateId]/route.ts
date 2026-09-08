import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  deleteExamStructureTemplate,
  editExamStructureTemplate,
} from "@/lib/services/exam-structure-template.service";
import {
  deleteExamStructureTemplateSchema,
  examStructureTemplateIdSchema,
  updateExamStructureTemplateSchema,
} from "@/lib/validations/exam-structure-template";
import type { ApiSuccessResponse } from "@/types/api";
import type { ExamStructureTemplate } from "@/types/exam-structure-template";

export const runtime = "nodejs";

interface ExamStructureTemplateRouteContext {
  params: Promise<{ templateId: string }>;
}

export async function PATCH(
  request: Request,
  context: ExamStructureTemplateRouteContext,
) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const templateId = examStructureTemplateIdSchema.parse(
      (await context.params).templateId,
    );
    const input = await parseJsonRequest(
      request,
      updateExamStructureTemplateSchema,
    );
    const template = await editExamStructureTemplate(admin, templateId, input);
    const response = {
      data: { template },
    } satisfies ApiSuccessResponse<{ template: ExamStructureTemplate }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: ExamStructureTemplateRouteContext,
) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const templateId = examStructureTemplateIdSchema.parse(
      (await context.params).templateId,
    );
    const input = await parseJsonRequest(
      request,
      deleteExamStructureTemplateSchema,
    );
    await deleteExamStructureTemplate(admin, templateId, input);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
