import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { createGrade, listGrades } from "@/lib/services/curriculum.service";
import { createGradeSchema } from "@/lib/validations/curriculum";
import type { ApiSuccessResponse } from "@/types/api";
import type { Grade } from "@/types/curriculum";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const grades = await listGrades(admin);
    const response = { data: { grades } } satisfies ApiSuccessResponse<{
      grades: Grade[];
    }>;
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const input = await parseJsonRequest(request, createGradeSchema);
    const grade = await createGrade(admin, input);
    const response = { data: { grade } } satisfies ApiSuccessResponse<{
      grade: Grade;
    }>;
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
