import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import {
  createExamStructureTemplate,
  listExamStructureTemplates,
} from "@/lib/services/exam-structure-template.service";
import { upsertExamStructureTemplateSchema } from "@/lib/validations/exam-structure-template";
import type { ApiSuccessResponse } from "@/types/api";
import type { ExamStructureTemplate } from "@/types/exam-structure-template";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const templates = await listExamStructureTemplates(admin);
    const response = {
      data: { templates },
    } satisfies ApiSuccessResponse<{
      templates: ExamStructureTemplate[];
    }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const input = await parseJsonRequest(
      request,
      upsertExamStructureTemplateSchema,
    );
    const template = await createExamStructureTemplate(admin, input);
    const response = {
      data: { template },
    } satisfies ApiSuccessResponse<{ template: ExamStructureTemplate }>;

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
