import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiSignRequest: vi.fn(),
  resource: vi.fn(),
  destroy: vi.fn(),
  url: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/cloudinary/client", () => ({
  getCloudinaryClient: () => ({
    utils: { api_sign_request: mocks.apiSignRequest },
    api: { resource: mocks.resource },
    uploader: { destroy: mocks.destroy },
    url: mocks.url,
  }),
}));

vi.mock("@/lib/env/server", () => ({
  getCloudinaryEnvironment: () => ({
    cloudName: "test-cloud",
    apiKey: "test-api-key",
    apiSecret: "test-api-secret",
  }),
}));

import {
  createSolutionPdfResponse,
  createSolutionPdfUploadTicket,
  verifySolutionPdfAsset,
} from "@/lib/cloudinary/solution-pdf";
import type { ExamPdfUploadReference } from "@/types/exam";

const now = new Date("2026-08-10T12:00:00.000Z");
const signature = "a".repeat(40);
const publicId =
  "thpt-mock-test/solutions/123e4567-e89b-42d3-a456-426614174000.pdf";
const secureUrl = `https://res.cloudinary.com/test-cloud/raw/authenticated/v1234567890/${publicId}`;
const signedUrl =
  "https://res.cloudinary.com/test-cloud/s--signed--/raw/authenticated/solution.pdf";

function createReference(): ExamPdfUploadReference {
  return {
    publicId,
    originalFilename: "loi-giai.pdf",
    timestamp: Math.floor(now.getTime() / 1000),
    signature,
  };
}

describe("Solution PDF Cloudinary flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubGlobal("fetch", mocks.fetch);
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.apiSignRequest.mockReturnValue(signature);
    mocks.url.mockReturnValue(signedUrl);
    mocks.destroy.mockResolvedValue({ result: "ok" });
    mocks.fetch.mockResolvedValue(new Response("%PDF-1.7", { status: 206 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("issues authenticated raw upload fields", () => {
    const ticket = createSolutionPdfUploadTicket({
      name: "loi-giai.pdf",
      type: "application/pdf",
      size: 1024,
    });

    expect(ticket.fields.type).toBe("authenticated");
    expect(ticket.fields.public_id).toMatch(
      /^thpt-mock-test\/solutions\/[a-f\d-]+\.pdf$/,
    );
    expect(JSON.stringify(ticket)).not.toContain("test-api-secret");
  });

  it("verifies content through a signed authenticated URL", async () => {
    mocks.resource.mockResolvedValue({
      public_id: publicId,
      resource_type: "raw",
      type: "authenticated",
      bytes: 4096,
      secure_url: secureUrl,
    });

    await expect(verifySolutionPdfAsset(createReference())).resolves.toEqual({
      publicId,
      secureUrl,
      originalFilename: "loi-giai.pdf",
    });
    expect(mocks.url).toHaveBeenCalledWith(publicId, {
      resource_type: "raw",
      type: "authenticated",
      secure: true,
      sign_url: true,
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      signedUrl,
      expect.objectContaining({
        headers: { Range: "bytes=0-4" },
        redirect: "error",
      }),
    );
  });

  it("proxies the asset without exposing the Cloudinary URL", async () => {
    mocks.fetch.mockResolvedValue(
      new Response("%PDF-1.7 solution", { status: 200 }),
    );

    const response = await createSolutionPdfResponse({
      publicId,
      secureUrl,
      originalFilename: "loi-giai.pdf",
    });

    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Location")).toBeNull();
    expect(await response.text()).toContain("%PDF-");
  });
});
