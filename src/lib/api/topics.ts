import { apiRequest } from "@/lib/api/client";
import type {
  BulkDeleteTopicsInput,
  CreateTopicInput,
  DeleteTopicInput,
  TopicImportInput,
  UpdateTopicInput,
} from "@/lib/validations/topic";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  Topic,
  TopicImportPreview,
  TopicImportResult,
} from "@/types/topic";

const TOPICS_ENDPOINT = "/api/admin/topics";

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function fetchTopics(
  search?: string,
): Promise<ApiSuccessResponse<{ topics: Topic[] }>> {
  const query = search ? `?q=${encodeURIComponent(search)}` : "";
  return apiRequest(`${TOPICS_ENDPOINT}${query}`);
}

export function createTopicRecord(
  input: CreateTopicInput,
): Promise<ApiSuccessResponse<{ topic: Topic }>> {
  return apiRequest(TOPICS_ENDPOINT, jsonRequest("POST", input));
}

export function updateTopicRecord(
  topicId: string,
  input: UpdateTopicInput,
): Promise<ApiSuccessResponse<{ topic: Topic }>> {
  return apiRequest(
    `${TOPICS_ENDPOINT}/${topicId}`,
    jsonRequest("PATCH", input),
  );
}

export function deleteTopicRecord(
  topicId: string,
  input: DeleteTopicInput,
): Promise<void> {
  return apiRequest(
    `${TOPICS_ENDPOINT}/${topicId}`,
    jsonRequest("DELETE", input),
  );
}

export function bulkDeleteTopicRecords(
  input: BulkDeleteTopicsInput,
): Promise<ApiSuccessResponse<{ deletedCount: number }>> {
  return apiRequest(
    `${TOPICS_ENDPOINT}/bulk-delete`,
    jsonRequest("POST", input),
  );
}

export function previewTopicImport(
  input: TopicImportInput,
): Promise<ApiSuccessResponse<{ preview: TopicImportPreview }>> {
  return apiRequest(
    `${TOPICS_ENDPOINT}/import/preview`,
    jsonRequest("POST", input),
  );
}

export function importTopicRecords(
  input: TopicImportInput,
): Promise<ApiSuccessResponse<{ result: TopicImportResult }>> {
  return apiRequest(`${TOPICS_ENDPOINT}/import`, jsonRequest("POST", input));
}
