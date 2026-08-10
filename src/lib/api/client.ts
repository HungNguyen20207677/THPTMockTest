import type { ApiErrorResponse } from "@/types/api";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function parseErrorPayload(body: string): ApiErrorResponse | null {
  try {
    return JSON.parse(body) as ApiErrorResponse;
  } catch {
    return null;
  }
}

export async function apiRequest<TResponse>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<TResponse> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  const response = await fetch(input, {
    ...init,
    headers,
  });
  const body = await response.text();

  if (!response.ok) {
    const payload = parseErrorPayload(body);

    throw new ApiClientError(
      payload?.error?.message ?? "Yêu cầu không thành công.",
      response.status,
      payload?.error?.code,
    );
  }

  if (!body) {
    return undefined as TResponse;
  }

  return JSON.parse(body) as TResponse;
}
