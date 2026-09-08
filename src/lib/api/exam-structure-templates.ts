import { apiRequest } from "@/lib/api/client";
import type {
  DeleteExamStructureTemplateInput,
  UpdateExamStructureTemplateInput,
  UpsertExamStructureTemplateInput,
} from "@/lib/validations/exam-structure-template";
import type { ApiSuccessResponse } from "@/types/api";
import type { ExamStructureTemplate } from "@/types/exam-structure-template";

const EXAM_STRUCTURE_TEMPLATES_ENDPOINT = "/api/admin/exam-structure-templates";

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function fetchExamStructureTemplates(): Promise<
  ApiSuccessResponse<{ templates: ExamStructureTemplate[] }>
> {
  return apiRequest(EXAM_STRUCTURE_TEMPLATES_ENDPOINT);
}

export function createExamStructureTemplateRecord(
  input: UpsertExamStructureTemplateInput,
): Promise<ApiSuccessResponse<{ template: ExamStructureTemplate }>> {
  return apiRequest(
    EXAM_STRUCTURE_TEMPLATES_ENDPOINT,
    jsonRequest("POST", input),
  );
}

export function updateExamStructureTemplateRecord(
  templateId: string,
  input: UpdateExamStructureTemplateInput,
): Promise<ApiSuccessResponse<{ template: ExamStructureTemplate }>> {
  return apiRequest(
    `${EXAM_STRUCTURE_TEMPLATES_ENDPOINT}/${templateId}`,
    jsonRequest("PATCH", input),
  );
}

export function deleteExamStructureTemplateRecord(
  templateId: string,
  input: DeleteExamStructureTemplateInput,
): Promise<void> {
  return apiRequest(
    `${EXAM_STRUCTURE_TEMPLATES_ENDPOINT}/${templateId}`,
    jsonRequest("DELETE", input),
  );
}
