import { toErrorResponse } from "@/lib/api/route-error";
import { requireApiRole } from "@/lib/auth/authorization";
import { createSolutionPdfResponse } from "@/lib/cloudinary/solution-pdf";
import { USER_ROLE } from "@/lib/constants/roles";
import { getAdminExamSolutionPdf } from "@/lib/services/exam.service";
import { examIdSchema } from "@/lib/validations/exam";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ examId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const admin = await requireApiRole(USER_ROLE.ADMIN);
    const examId = examIdSchema.parse((await context.params).examId);
    const asset = await getAdminExamSolutionPdf(admin, examId);
    return await createSolutionPdfResponse(asset);
  } catch (error) {
    return toErrorResponse(error);
  }
}
