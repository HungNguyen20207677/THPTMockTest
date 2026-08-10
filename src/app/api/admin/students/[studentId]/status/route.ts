import { NextResponse } from "next/server";

import { parseJsonRequest } from "@/lib/api/request";
import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { setStudentActiveStatus } from "@/lib/services/student.service";
import {
  studentIdSchema,
  updateStudentStatusSchema,
} from "@/lib/validations/user";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentAccount } from "@/types/user";

export const runtime = "nodejs";

interface StudentStatusRouteContext {
  params: Promise<{ studentId: string }>;
}

export async function PATCH(
  request: Request,
  context: StudentStatusRouteContext,
) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const studentId = studentIdSchema.parse((await context.params).studentId);
    const input = await parseJsonRequest(request, updateStudentStatusSchema);
    const student = await setStudentActiveStatus(
      admin,
      studentId,
      input.isActive,
    );
    const response = {
      data: { student },
    } satisfies ApiSuccessResponse<{ student: StudentAccount }>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
