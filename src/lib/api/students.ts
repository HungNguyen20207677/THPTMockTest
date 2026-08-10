import { apiRequest } from "@/lib/api/client";
import type {
  CreateStudentInput,
  ResetStudentPasswordInput,
  UpdateStudentInput,
  UpdateStudentStatusInput,
} from "@/lib/validations/user";
import type { ApiSuccessResponse } from "@/types/api";
import type { StudentAccount } from "@/types/user";

const STUDENTS_ENDPOINT = "/api/admin/students";

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

export function fetchStudents(): Promise<
  ApiSuccessResponse<{ students: StudentAccount[] }>
> {
  return apiRequest(STUDENTS_ENDPOINT);
}

export function createStudentAccount(
  input: CreateStudentInput,
): Promise<ApiSuccessResponse<{ student: StudentAccount }>> {
  return apiRequest(STUDENTS_ENDPOINT, jsonRequest("POST", input));
}

export function updateStudentAccount(
  studentId: string,
  input: UpdateStudentInput,
): Promise<ApiSuccessResponse<{ student: StudentAccount }>> {
  return apiRequest(
    `${STUDENTS_ENDPOINT}/${studentId}`,
    jsonRequest("PATCH", input),
  );
}

export function resetStudentAccountPassword(
  studentId: string,
  input: ResetStudentPasswordInput,
): Promise<void> {
  return apiRequest(
    `${STUDENTS_ENDPOINT}/${studentId}/password`,
    jsonRequest("PATCH", input),
  );
}

export function updateStudentAccountStatus(
  studentId: string,
  input: UpdateStudentStatusInput,
): Promise<ApiSuccessResponse<{ student: StudentAccount }>> {
  return apiRequest(
    `${STUDENTS_ENDPOINT}/${studentId}/status`,
    jsonRequest("PATCH", input),
  );
}

export function deleteStudentAccount(studentId: string): Promise<void> {
  return apiRequest(`${STUDENTS_ENDPOINT}/${studentId}`, {
    method: "DELETE",
  });
}
