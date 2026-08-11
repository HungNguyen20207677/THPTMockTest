import { apiRequest } from "@/lib/api/client";
import type { ExamAttemptStatus } from "@/types/exam-attempt";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  AdminAttemptDetail,
  AdminDashboardSummary,
  AdminExamResults,
  AdminResultList,
  AdminStudentDetail,
} from "@/types/reporting";

export interface AdminResultFilters {
  page?: number;
  pageSize?: number;
  studentId?: string;
  examId?: string;
  status?: Exclude<ExamAttemptStatus, "IN_PROGRESS">;
}

function toQueryString(values: AdminResultFilters) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function fetchAdminDashboardSummary(): Promise<
  ApiSuccessResponse<{ summary: AdminDashboardSummary }>
> {
  return apiRequest("/api/admin/dashboard");
}

export function fetchAdminResults(
  filters: AdminResultFilters = {},
): Promise<ApiSuccessResponse<AdminResultList>> {
  return apiRequest(`/api/admin/results${toQueryString(filters)}`);
}

export function fetchAdminAttemptDetail(
  attemptId: string,
): Promise<ApiSuccessResponse<{ detail: AdminAttemptDetail }>> {
  return apiRequest(`/api/admin/results/${attemptId}`);
}

export function fetchAdminStudentDetail(
  studentId: string,
): Promise<ApiSuccessResponse<{ detail: AdminStudentDetail }>> {
  return apiRequest(`/api/admin/students/${studentId}`);
}

export function fetchAdminExamResults(
  examId: string,
): Promise<ApiSuccessResponse<{ report: AdminExamResults }>> {
  return apiRequest(`/api/admin/exams/${examId}/results`);
}
