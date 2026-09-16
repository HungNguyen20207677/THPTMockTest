import { apiRequest } from "@/lib/api/client";
import type {
  CreateChapterInput,
  CreateGradeInput,
  DeleteChapterInput,
  DeleteGradeInput,
  UpdateChapterInput,
  UpdateGradeInput,
} from "@/lib/validations/curriculum";
import type { ApiSuccessResponse } from "@/types/api";
import type { Chapter, Grade } from "@/types/curriculum";

const GRADES_ENDPOINT = "/api/admin/grades";
const CHAPTERS_ENDPOINT = "/api/admin/chapters";

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function fetchGrades(): Promise<
  ApiSuccessResponse<{ grades: Grade[] }>
> {
  return apiRequest(GRADES_ENDPOINT);
}

export function createGradeRecord(
  input: CreateGradeInput,
): Promise<ApiSuccessResponse<{ grade: Grade }>> {
  return apiRequest(GRADES_ENDPOINT, jsonRequest("POST", input));
}

export function updateGradeRecord(
  gradeId: string,
  input: UpdateGradeInput,
): Promise<ApiSuccessResponse<{ grade: Grade }>> {
  return apiRequest(
    `${GRADES_ENDPOINT}/${gradeId}`,
    jsonRequest("PATCH", input),
  );
}

export function deleteGradeRecord(
  gradeId: string,
  input: DeleteGradeInput,
): Promise<void> {
  return apiRequest(
    `${GRADES_ENDPOINT}/${gradeId}`,
    jsonRequest("DELETE", input),
  );
}

export function fetchChapters(
  gradeId?: string,
): Promise<ApiSuccessResponse<{ chapters: Chapter[] }>> {
  const query = gradeId ? `?gradeId=${encodeURIComponent(gradeId)}` : "";
  return apiRequest(`${CHAPTERS_ENDPOINT}${query}`);
}

export function createChapterRecord(
  input: CreateChapterInput,
): Promise<ApiSuccessResponse<{ chapter: Chapter }>> {
  return apiRequest(CHAPTERS_ENDPOINT, jsonRequest("POST", input));
}

export function updateChapterRecord(
  chapterId: string,
  input: UpdateChapterInput,
): Promise<ApiSuccessResponse<{ chapter: Chapter }>> {
  return apiRequest(
    `${CHAPTERS_ENDPOINT}/${chapterId}`,
    jsonRequest("PATCH", input),
  );
}

export function deleteChapterRecord(
  chapterId: string,
  input: DeleteChapterInput,
): Promise<void> {
  return apiRequest(
    `${CHAPTERS_ENDPOINT}/${chapterId}`,
    jsonRequest("DELETE", input),
  );
}
