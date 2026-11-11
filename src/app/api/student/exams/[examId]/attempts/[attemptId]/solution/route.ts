import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { createSolutionPdfResponse } from "@/lib/cloudinary/solution-pdf";
import { USER_ROLE } from "@/lib/constants/roles";
import { getStudentExamAttemptSolutionPdf } from "@/lib/services/exam-attempt.service";
import { attemptIdSchema } from "@/lib/validations/exam-attempt";
import { examIdSchema } from "@/lib/validations/exam";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ examId: string; attemptId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const student = await requireApiRole(USER_ROLE.STUDENT);
    const params = await context.params;
    const examId = examIdSchema.parse(params.examId);
    const attemptId = attemptIdSchema.parse(params.attemptId);
    const asset = await getStudentExamAttemptSolutionPdf(
      student,
      examId,
      attemptId,
    );
    return await createSolutionPdfResponse(asset);
  } catch (error) {
    return toErrorResponse(error);
  }
}
