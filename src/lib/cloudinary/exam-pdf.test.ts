import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiSignRequest: vi.fn(),
  resource: vi.fn(),
  destroy: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/cloudinary/client", () => ({
  getCloudinaryClient: () => ({
    utils: { api_sign_request: mocks.apiSignRequest },
    api: { resource: mocks.resource },
    uploader: { destroy: mocks.destroy },
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
  createExamPdfUploadTicket,
  discardExamPdfUpload,
  verifyExamPdfAsset,
} from "@/lib/cloudinary/exam-pdf";
import {
  EXAM_PDF_MAX_BYTES,
  EXAM_PDF_UPLOAD_SIGNATURE_MAX_AGE_SECONDS,
} from "@/lib/constants/exam";
import { getExamPdfValidationError } from "@/lib/validations/exam-pdf";
import type { ExamPdfUploadReference } from "@/types/exam";

const now = new Date("2026-08-10T12:00:00.000Z");
const signature = "a".repeat(40);
const publicId =
  "thpt-mock-test/exams/123e4567-e89b-42d3-a456-426614174000.pdf";
const secureUrl = `https://res.cloudinary.com/test-cloud/raw/upload/v1234567890/${publicId}`;

function createReference(): ExamPdfUploadReference {
  return {
    publicId,
    originalFilename: "de-thi.pdf",
    timestamp: Math.floor(now.getTime() / 1000),
    signature,
  };
}

describe("Exam PDF Cloudinary flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.apiSignRequest.mockReset();
    mocks.resource.mockReset();
    mocks.destroy.mockReset();
    mocks.fetch.mockReset();
    mocks.apiSignRequest.mockReturnValue(signature);
    mocks.destroy.mockResolvedValue({ result: "ok" });
    mocks.fetch.mockResolvedValue(new Response("%PDF-1.7", { status: 206 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("generates signed raw-upload parameters without exposing the secret", () => {
    const ticket = createExamPdfUploadTicket({
      name: "de-thi.pdf",
      type: "application/pdf",
      size: 1024,
    });

    expect(ticket.uploadUrl).toBe(
      "https://api.cloudinary.com/v1_1/test-cloud/raw/upload",
    );
    expect(ticket.apiKey).toBe("test-api-key");
    expect(ticket.signature).toBe(signature);
    expect(ticket.fields).toMatchObject({
      overwrite: "0",
      allowed_formats: "pdf",
      filename_override: "de-thi.pdf",
      type: "upload",
      timestamp: String(Math.floor(now.getTime() / 1000)),
    });
    expect(ticket.fields.public_id).toMatch(
      /^thpt-mock-test\/exams\/[a-f\d-]+\.pdf$/,
    );
    expect(mocks.apiSignRequest).toHaveBeenCalledWith(
      ticket.fields,
      "test-api-secret",
    );
    expect(JSON.stringify(ticket)).not.toContain("test-api-secret");
  });

  it("canonicalizes the filename before signing and returning it", () => {
    const ticket = createExamPdfUploadTicket({
      name: " de-thi.pdf",
      type: "application/pdf",
      size: 1024,
    });

    expect(ticket.fields.filename_override).toBe("de-thi.pdf");
    expect(mocks.apiSignRequest).toHaveBeenCalledWith(
      expect.objectContaining({ filename_override: "de-thi.pdf" }),
      "test-api-secret",
    );
  });

  it("verifies the raw PDF asset through Cloudinary before persistence", async () => {
    mocks.resource.mockResolvedValue({
      public_id: publicId,
      resource_type: "raw",
      type: "upload",
      bytes: 4096,
      secure_url: secureUrl,
    });

    const result = await verifyExamPdfAsset(createReference());

    expect(mocks.resource).toHaveBeenCalledWith(publicId, {
      resource_type: "raw",
      type: "upload",
      timeout: 60_000,
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      secureUrl,
      expect.objectContaining({
        headers: { Range: "bytes=0-4" },
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result).toEqual({
      publicId,
      secureUrl,
      originalFilename: "de-thi.pdf",
    });
  });

  it("rejects a resource with the wrong Cloudinary type", async () => {
    mocks.resource.mockResolvedValue({
      public_id: publicId,
      resource_type: "image",
      type: "upload",
      bytes: 4096,
      secure_url: "https://res.cloudinary.com/test/image/upload/exam.pdf",
    });

    await expect(verifyExamPdfAsset(createReference())).rejects.toMatchObject({
      code: "INVALID_EXAM_PDF",
      statusCode: 400,
    });
    expect(mocks.destroy).not.toHaveBeenCalled();
  });

  it("rejects an oversized Cloudinary asset", async () => {
    mocks.resource.mockResolvedValue({
      public_id: publicId,
      resource_type: "raw",
      type: "upload",
      bytes: EXAM_PDF_MAX_BYTES + 1,
      secure_url: secureUrl,
    });

    await expect(verifyExamPdfAsset(createReference())).rejects.toMatchObject({
      code: "PDF_TOO_LARGE",
      statusCode: 413,
    });
    expect(mocks.destroy).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects a tampered signature before looking up an asset", async () => {
    mocks.apiSignRequest.mockReturnValue("b".repeat(40));

    await expect(verifyExamPdfAsset(createReference())).rejects.toMatchObject({
      code: "INVALID_EXAM_PDF",
      statusCode: 400,
    });
    expect(mocks.resource).not.toHaveBeenCalled();
    expect(mocks.destroy).not.toHaveBeenCalled();
  });

  it("rejects an expired authentic reference before looking up an asset", async () => {
    const reference = createReference();
    reference.timestamp -= EXAM_PDF_UPLOAD_SIGNATURE_MAX_AGE_SECONDS + 1;

    await expect(verifyExamPdfAsset(reference)).rejects.toMatchObject({
      code: "INVALID_EXAM_PDF",
      statusCode: 400,
    });
    expect(mocks.apiSignRequest).toHaveBeenCalledOnce();
    expect(mocks.resource).not.toHaveBeenCalled();
  });

  it("rejects a delivery URL outside the configured raw asset path", async () => {
    mocks.resource.mockResolvedValue({
      public_id: publicId,
      resource_type: "raw",
      type: "upload",
      bytes: 4096,
      secure_url: `https://res.cloudinary.com/other-cloud/raw/upload/v1234567890/${publicId}`,
    });

    await expect(verifyExamPdfAsset(createReference())).rejects.toMatchObject({
      code: "INVALID_EXAM_PDF",
      statusCode: 400,
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects content without a PDF signature", async () => {
    mocks.resource.mockResolvedValue({
      public_id: publicId,
      resource_type: "raw",
      type: "upload",
      bytes: 4096,
      secure_url: secureUrl,
    });
    mocks.fetch.mockResolvedValue(new Response("plain text", { status: 206 }));

    await expect(verifyExamPdfAsset(createReference())).rejects.toMatchObject({
      code: "INVALID_EXAM_PDF",
      statusCode: 400,
    });
  });

  it("allows an authentic expired reference to discard an unclaimed upload", async () => {
    const reference = createReference();
    reference.timestamp -= EXAM_PDF_UPLOAD_SIGNATURE_MAX_AGE_SECONDS + 1;

    await discardExamPdfUpload(reference);

    expect(mocks.destroy).toHaveBeenCalledWith(publicId, {
      resource_type: "raw",
      type: "upload",
      invalidate: true,
    });
  });

  it("retries discard when an ambiguous upload is not visible yet", async () => {
    mocks.destroy
      .mockResolvedValueOnce({ result: "not found" })
      .mockResolvedValueOnce({ result: "not found" })
      .mockResolvedValueOnce({ result: "ok" });

    const discard = discardExamPdfUpload(createReference());
    await vi.advanceTimersByTimeAsync(2_000);
    await discard;

    expect(mocks.destroy).toHaveBeenCalledTimes(3);
  });
});

describe("exam PDF client metadata validation", () => {
  it.each([
    {
      file: { name: "de-thi.txt", type: "application/pdf", size: 100 },
      message: "phần mở rộng",
    },
    {
      file: { name: "de-thi.pdf", type: "text/plain", size: 100 },
      message: "định dạng PDF",
    },
    {
      file: { name: "de-thi.pdf", type: "application/pdf", size: 0 },
      message: "không được để trống",
    },
    {
      file: {
        name: "de-thi.pdf",
        type: "application/pdf",
        size: EXAM_PDF_MAX_BYTES + 1,
      },
      message: "15 MB",
    },
  ])("rejects invalid metadata containing $message", ({ file, message }) => {
    expect(getExamPdfValidationError(file)).toContain(message);
  });
});
