import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api/client";

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("normalizes timeouts while reading the response body", async () => {
    const timeoutError = new DOMException("Request timed out", "TimeoutError");
    const timeoutSignal = AbortSignal.abort(timeoutError);
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockRejectedValue(timeoutError),
      }),
    );

    await expect(apiRequest("/api/stalled")).rejects.toMatchObject({
      name: "ApiClientError",
      code: "REQUEST_TIMEOUT",
      statusCode: 408,
    });
  });
});
