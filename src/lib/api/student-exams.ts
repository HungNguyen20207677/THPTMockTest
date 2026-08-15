import { apiRequest } from "@/lib/api/client";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  AttemptAnswers,
  StudentExamAttemptContext,
  StudentExamAttemptResult,
  StudentExamList,
  StudentExamAttemptMutationResult,
} from "@/types/exam-attempt";
import type { StudentExamAttemptHistory } from "@/types/reporting";

const STUDENT_EXAMS_ENDPOINT = "/api/student/exams";

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function fetchStudentExams(): Promise<
  ApiSuccessResponse<StudentExamList>
> {
  return apiRequest(STUDENT_EXAMS_ENDPOINT);
}

export function startStudentExamAttempt(
  examId: string,
  resumeAttemptId?: string,
): Promise<ApiSuccessResponse<{ context: StudentExamAttemptContext }>> {
  return apiRequest(
    `${STUDENT_EXAMS_ENDPOINT}/${examId}/attempts`,
    jsonRequest("POST", { resumeAttemptId }),
  );
}

export function fetchStudentExamAttempt(
  examId: string,
  attemptId: string,
): Promise<ApiSuccessResponse<{ context: StudentExamAttemptContext }>> {
  return apiRequest(
    `${STUDENT_EXAMS_ENDPOINT}/${examId}/attempts/${attemptId}`,
  );
}

function getAttemptEndpoint(examId: string, attemptId: string): string {
  return `${STUDENT_EXAMS_ENDPOINT}/${examId}/attempts/${attemptId}`;
}

export function saveStudentExamAttemptAnswers(
  examId: string,
  attemptId: string,
  answers: AttemptAnswers,
): Promise<ApiSuccessResponse<StudentExamAttemptMutationResult>> {
  return apiRequest(
    `${getAttemptEndpoint(examId, attemptId)}/answers`,
    jsonRequest("PATCH", { answers }),
  );
}

export function submitStudentExamAttempt(
  examId: string,
  attemptId: string,
  answers: AttemptAnswers,
): Promise<ApiSuccessResponse<StudentExamAttemptMutationResult>> {
  return apiRequest(
    `${getAttemptEndpoint(examId, attemptId)}/submit`,
    jsonRequest("POST", { answers }),
  );
}

export function finalizeStudentExamAttempt(
  examId: string,
  attemptId: string,
): Promise<ApiSuccessResponse<StudentExamAttemptMutationResult>> {
  return apiRequest(
    `${getAttemptEndpoint(examId, attemptId)}/auto-submit`,
    jsonRequest("POST", {}),
  );
}

export function fetchStudentExamAttemptResult(
  examId: string,
  attemptId: string,
): Promise<ApiSuccessResponse<{ result: StudentExamAttemptResult }>> {
  return apiRequest(`${getAttemptEndpoint(examId, attemptId)}/result`);
}

export function fetchStudentExamAttemptHistory(
  examId: string,
  page = 1,
  pageSize = 20,
): Promise<ApiSuccessResponse<{ history: StudentExamAttemptHistory }>> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return apiRequest(
    `${STUDENT_EXAMS_ENDPOINT}/${examId}/history?${searchParams.toString()}`,
  );
}
