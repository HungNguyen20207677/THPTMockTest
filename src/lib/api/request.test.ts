import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseJsonRequest } from "@/lib/api/request";

const schema = z.strictObject({ value: z.string() });

describe("JSON request parsing", () => {
  it("accepts a bounded application/json request", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ value: "ok" }),
    });

    await expect(parseJsonRequest(request, schema)).resolves.toEqual({
      value: "ok",
    });
  });

  it("rejects JSON sent as a CORS-safelisted text body", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ value: "ok" }),
    });

    await expect(parseJsonRequest(request, schema)).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA_TYPE",
      statusCode: 415,
    });
  });

  it("rejects a chunked body after the JSON size limit", async () => {
    const oversizedValue = "x".repeat(256 * 1024);
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify({ value: oversizedValue })),
          );
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(parseJsonRequest(request, schema)).rejects.toMatchObject({
      code: "REQUEST_TOO_LARGE",
      statusCode: 413,
    });
  });
});
