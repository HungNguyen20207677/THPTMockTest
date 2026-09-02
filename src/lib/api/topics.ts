import { apiRequest } from "@/lib/api/client";
import type { CreateTopicInput } from "@/lib/validations/topic";
import type { ApiSuccessResponse } from "@/types/api";
import type { Topic } from "@/types/topic";

const TOPICS_ENDPOINT = "/api/admin/topics";

export function fetchTopics(
  search?: string,
): Promise<ApiSuccessResponse<{ topics: Topic[] }>> {
  const query = search ? `?q=${encodeURIComponent(search)}` : "";
  return apiRequest(`${TOPICS_ENDPOINT}${query}`);
}

export function createTopicRecord(
  input: CreateTopicInput,
): Promise<ApiSuccessResponse<{ topic: Topic }>> {
  return apiRequest(TOPICS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
