import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiRole: vi.fn(),
  getAdminExamResults: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireApiRole: mocks.requireApiRole,
}));

vi.mock("@/lib/services/reporting.service", () => ({
  getAdminExamResults: mocks.getAdminExamResults,
}));

import { GET } from "@/app/api/admin/exams/[examId]/results/route";
import { USER_ROLE } from "@/lib/constants/roles";
import { ForbiddenError } from "@/lib/errors/app-error";

describe("ADMIN Exam results route", () => {
  beforeEach(() => {
    mocks.requireApiRole.mockReset();
    mocks.getAdminExamResults.mockReset();
  });

  it("rejects STUDENT access before returning question statistics", async () => {
    mocks.requireApiRole.mockRejectedValue(new ForbiddenError());
    const examId = "507f1f77bcf86cd799439011";

    const response = await GET(
      new Request(`http://localhost/api/admin/exams/${examId}/results`),
      { params: Promise.resolve({ examId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requireApiRole).toHaveBeenCalledWith(USER_ROLE.ADMIN);
    expect(mocks.getAdminExamResults).not.toHaveBeenCalled();
  });
});
