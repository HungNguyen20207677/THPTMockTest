import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { deleteStudent, editStudent } from "@/lib/services/student.service";
import { studentIdSchema, updateStudentSchema } from "@/lib/validations/user";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentAccount } from "@/types/user";

export const runtime = "nodejs";

interface StudentRouteContext {
  params: Promise<{ studentId: string }>;
}

export async function PATCH(request: Request, context: StudentRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const studentId = studentIdSchema.parse((await context.params).studentId);
    const input = await parseJsonRequest(request, updateStudentSchema);
    const student = await editStudent(admin, studentId, input);
    const response = {
      data: { student },
    } satisfies ApiSuccessResponse<{ student: StudentAccount }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: StudentRouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const studentId = studentIdSchema.parse((await context.params).studentId);
    await deleteStudent(admin, studentId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
