import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiRole: vi.fn(),
  discardUnclaimedExamPdfUpload: vi.fn(),
  issueExamPdfUploadTicket: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireApiRole: mocks.requireApiRole,
}));

vi.mock("@/lib/services/exam.service", () => ({
  discardUnclaimedExamPdfUpload: mocks.discardUnclaimedExamPdfUpload,
  issueExamPdfUploadTicket: mocks.issueExamPdfUploadTicket,
}));

import { DELETE as DELETE_PDF } from "@/app/api/admin/exams/pdf/route";
import { POST } from "@/app/api/admin/exams/pdf/signature/route";
import { AuthenticationRequiredError } from "@/lib/errors/app-error";

describe("Exam PDF routes", () => {
  beforeEach(() => {
    mocks.requireApiRole.mockReset();
    mocks.discardUnclaimedExamPdfUpload.mockReset();
    mocks.issueExamPdfUploadTicket.mockReset();
  });

  it("rejects an unauthenticated signature request", async () => {
    mocks.requireApiRole.mockRejectedValue(new AuthenticationRequiredError());
    const request = new Request(
      "http://localhost/api/admin/exams/pdf/signature",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "de-thi.pdf",
          type: "application/pdf",
          size: 1024,
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Vui lòng đăng nhập để tiếp tục.",
      },
    });
    expect(mocks.issueExamPdfUploadTicket).not.toHaveBeenCalled();
  });

  it("accepts a signed reference for best-effort orphan cleanup", async () => {
    mocks.discardUnclaimedExamPdfUpload.mockResolvedValue(undefined);
    const reference = {
      publicId: "thpt-mock-test/exams/123e4567-e89b-42d3-a456-426614174000.pdf",
      originalFilename: "de-thi.pdf",
      timestamp: 1_786_363_200,
      signature: "a".repeat(40),
    };
    const request = new Request("http://localhost/api/admin/exams/pdf", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reference),
    });

    const response = await DELETE_PDF(request);

    expect(response.status).toBe(204);
    expect(mocks.discardUnclaimedExamPdfUpload).toHaveBeenCalledWith(reference);
  });
});
