import { apiRequest } from "@/lib/api/client";
import type {
  CreateTopicInput,
  DeleteTopicInput,
  UpdateTopicInput,
} from "@/lib/validations/topic";
import type { ApiSuccessResponse } from "@/types/api";
import type { Topic } from "@/types/topic";

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
