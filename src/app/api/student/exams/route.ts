import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";
import { listStudentExams } from "@/lib/services/exam-attempt.service";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentExamList } from "@/types/exam-attempt";

export const runtime = "nodejs";

export async function GET() {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    const examList = await listStudentExams(student);
    const response = {
      data: examList,
    } satisfies ApiSuccessResponse<StudentExamList>;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
