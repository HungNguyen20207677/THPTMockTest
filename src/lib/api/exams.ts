import { apiRequest } from "@/lib/api/client";
import type {
  DeleteExamInput,
  UpdateExamStatusInput,
  UpdateExamInput,
  UpsertExamInput,
} from "@/lib/validations/exam";
import type { ApiSuccessResponse } from "@/types/api";
import type { ExamDetail, ExamSummary } from "@/types/exam";

const EXAMS_ENDPOINT = "/api/admin/exams";

function examFormData(input: UpsertExamInput, pdf?: File): FormData {
  const formData = new FormData();
  formData.set("payload", JSON.stringify(input));

  if (pdf) {
    formData.set("pdf", pdf);
  }

  return formData;
}

export function fetchExams(): Promise<
  ApiSuccessResponse<{ exams: ExamSummary[] }>
> {
  return apiRequest(EXAMS_ENDPOINT);
}

export function fetchExam(
  examId: string,
): Promise<ApiSuccessResponse<{ exam: ExamDetail }>> {
  return apiRequest(`${EXAMS_ENDPOINT}/${examId}`);
}

export function createExamRecord(
  input: UpsertExamInput,
  pdf: File,
): Promise<ApiSuccessResponse<{ exam: ExamDetail }>> {
  return apiRequest(EXAMS_ENDPOINT, {
    method: "POST",
    body: examFormData(input, pdf),
  });
}

export function updateExamRecord(
  examId: string,
  input: UpdateExamInput,
  replacementPdf?: File,
): Promise<ApiSuccessResponse<{ exam: ExamDetail }>> {
  return apiRequest(`${EXAMS_ENDPOINT}/${examId}`, {
    method: "PATCH",
    body: examFormData(input, replacementPdf),
  });
}

export function updateExamRecordStatus(
  examId: string,
  input: UpdateExamStatusInput,
): Promise<ApiSuccessResponse<{ exam: ExamDetail }>> {
  return apiRequest(`${EXAMS_ENDPOINT}/${examId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteExamRecord(
  examId: string,
  input: DeleteExamInput,
): Promise<void> {
  return apiRequest(`${EXAMS_ENDPOINT}/${examId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
