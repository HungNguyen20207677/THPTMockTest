import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { resetStudentPassword } from "@/lib/services/student.service";
import {
  resetStudentPasswordSchema,
  studentIdSchema,
} from "@/lib/validations/user";

export const runtime = "nodejs";

interface StudentPasswordRouteContext {
  params: Promise<{ studentId: string }>;
}

export async function PATCH(
  request: Request,
  context: StudentPasswordRouteContext,
) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const studentId = studentIdSchema.parse((await context.params).studentId);
    const input = await parseJsonRequest(request, resetStudentPasswordSchema);
    await resetStudentPassword(admin, studentId, input.password);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
