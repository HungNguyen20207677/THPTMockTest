import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiRole: vi.fn(),
  getAdminExamAssignmentCompletion: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireApiRole: mocks.requireApiRole,
}));

vi.mock("@/lib/services/reporting.service", () => ({
  getAdminExamAssignmentCompletion: mocks.getAdminExamAssignmentCompletion,
}));

import { GET } from "@/app/api/admin/exams/[examId]/completions/route";
import { USER_ROLE } from "@/lib/constants/roles";
import { ForbiddenError } from "@/lib/errors/app-error";

const examId = "507f1f77bcf86cd799439011";

describe("ADMIN Exam completion route", () => {
  beforeEach(() => {
    mocks.requireApiRole.mockReset();
    mocks.getAdminExamAssignmentCompletion.mockReset();
  });

  it("returns only the ADMIN completion report page", async () => {
    const admin = {
      id: "admin-id",
      username: "admin",
      fullName: "Quan Tri",
      role: USER_ROLE.ADMIN,
    };
    const report = {
      exam: { id: examId, title: "Exam", status: "PUBLISHED" },
      totals: { assigned: 0 },
      students: [],
      pagination: { page: 2, pageSize: 10, totalItems: 0, totalPages: 0 },
    };
    mocks.requireApiRole.mockResolvedValue(admin);
    mocks.getAdminExamAssignmentCompletion.mockResolvedValue(report);

    const response = await GET(
      new Request(
        `http://localhost/api/admin/exams/${examId}/completions?page=2&pageSize=10`,
      ),
      { params: Promise.resolve({ examId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { report } });
    expect(mocks.requireApiRole).toHaveBeenCalledWith(USER_ROLE.ADMIN);
    expect(mocks.getAdminExamAssignmentCompletion).toHaveBeenCalledWith(
      admin,
      examId,
      { page: 2, pageSize: 10 },
    );
  });

  it("rejects STUDENT access before reading any progress", async () => {
    mocks.requireApiRole.mockRejectedValue(new ForbiddenError());

    const response = await GET(
      new Request(
        `http://localhost/api/admin/exams/${examId}/completions?page=1`,
      ),
      { params: Promise.resolve({ examId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.getAdminExamAssignmentCompletion).not.toHaveBeenCalled();
  });
});
