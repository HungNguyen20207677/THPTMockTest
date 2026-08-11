import type { ApiErrorResponse } from "@/types/api";

const API_REQUEST_TIMEOUT_MS = 30_000;

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

  const timeoutSignal = AbortSignal.timeout(API_REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  let response: Response;
  let body: string;

  try {
    response = await fetch(input, {
      ...init,
      cache: init?.cache ?? "no-store",
      headers,
      signal,
    });
    body = await response.text();
  } catch (error) {
    if (timeoutSignal.aborted && !init?.signal?.aborted) {
      throw new ApiClientError(
        "Yêu cầu quá thời gian chờ. Vui lòng thử lại.",
        408,
        "REQUEST_TIMEOUT",
      );
    }

    throw error;
  }
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
