import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { deleteGrade, editGrade } from "@/lib/services/curriculum.service";
import {
  deleteGradeSchema,
  gradeIdSchema,
  updateGradeSchema,
} from "@/lib/validations/curriculum";
import type { ApiSuccessResponse } from "@/types/api";
import type { Grade } from "@/types/curriculum";

export const runtime = "nodejs";

interface GradeRouteContext {
  params: Promise<{ gradeId: string }>;
}

export async function PATCH(request: Request, context: GradeRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const gradeId = gradeIdSchema.parse((await context.params).gradeId);
    const input = await parseJsonRequest(request, updateGradeSchema);
    const grade = await editGrade(admin, gradeId, input);
    const response = { data: { grade } } satisfies ApiSuccessResponse<{
      grade: Grade;
    }>;
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: GradeRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const gradeId = gradeIdSchema.parse((await context.params).gradeId);
    const input = await parseJsonRequest(request, deleteGradeSchema);
    await deleteGrade(admin, gradeId, input);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
