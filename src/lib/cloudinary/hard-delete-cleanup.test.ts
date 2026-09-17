import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteEssayImage: vi.fn(),
  deleteExamPdf: vi.fn(),
}));

vi.mock("@/lib/cloudinary/essay-image", () => ({
  deleteEssayImage: mocks.deleteEssayImage,
}));

vi.mock("@/lib/cloudinary/exam-pdf", () => ({
  deleteExamPdf: mocks.deleteExamPdf,
}));

import {
  cleanupCloudinaryAfterHardDelete,
  HARD_DELETE_CLEANUP_WARNING,
} from "@/lib/cloudinary/hard-delete-cleanup";

describe("Cloudinary hard-delete cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.deleteEssayImage.mockReset();
    mocks.deleteEssayImage.mockResolvedValue(undefined);
    mocks.deleteExamPdf.mockReset();
    mocks.deleteExamPdf.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates images and deletes them before the Exam PDF", async () => {
    const result = await cleanupCloudinaryAfterHardDelete({
      essayImagePublicIds: ["image-1", "image-1", "image-2"],
      examPdfPublicId: "exam-pdf",
    });

    expect(mocks.deleteEssayImage).toHaveBeenCalledTimes(2);
    expect(mocks.deleteEssayImage).toHaveBeenCalledWith("image-1");
    expect(mocks.deleteEssayImage).toHaveBeenCalledWith("image-2");
    expect(mocks.deleteExamPdf).toHaveBeenCalledWith("exam-pdf");
    expect(
      Math.max(...mocks.deleteEssayImage.mock.invocationCallOrder),
    ).toBeLessThan(mocks.deleteExamPdf.mock.invocationCallOrder[0]!);
    expect(result).toEqual({ cleanupWarning: null });
  });

  it("retries transient failures and succeeds without a warning", async () => {
    mocks.deleteEssayImage
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce(undefined);

    const cleanup = cleanupCloudinaryAfterHardDelete({
      essayImagePublicIds: ["image-1"],
    });
    await vi.runAllTimersAsync();

    await expect(cleanup).resolves.toEqual({ cleanupWarning: null });
    expect(mocks.deleteEssayImage).toHaveBeenCalledTimes(3);
  });

  it("handles an already-missing resource without retrying", async () => {
    mocks.deleteEssayImage.mockRejectedValue({ http_code: 404 });

    await expect(
      cleanupCloudinaryAfterHardDelete({
        essayImagePublicIds: ["already-missing"],
      }),
    ).resolves.toEqual({ cleanupWarning: null });
    expect(mocks.deleteEssayImage).toHaveBeenCalledOnce();
  });

  it("reports sanitized metadata and returns a warning after retries fail", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.deleteExamPdf.mockRejectedValue(
      new Error("secret credential in provider response"),
    );

    const cleanup = cleanupCloudinaryAfterHardDelete({
      essayImagePublicIds: [],
      examPdfPublicId: "exam-pdf",
    });
    await vi.runAllTimersAsync();

    await expect(cleanup).resolves.toEqual({
      cleanupWarning: HARD_DELETE_CLEANUP_WARNING,
    });
    expect(mocks.deleteExamPdf).toHaveBeenCalledTimes(3);
    expect(consoleError).toHaveBeenCalledWith(
      "Cloudinary hard-delete cleanup failed.",
      {
        resourceType: "exam-pdf",
        publicId: "exam-pdf",
        errorName: "Error",
        attempts: 3,
      },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "secret credential",
    );
    consoleError.mockRestore();
  });
});
