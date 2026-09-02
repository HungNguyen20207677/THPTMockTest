import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiRole: vi.fn(),
  getAdminStudentDetail: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireApiRole: mocks.requireApiRole,
}));

vi.mock("@/lib/services/reporting.service", () => ({
  getAdminStudentDetail: mocks.getAdminStudentDetail,
}));

vi.mock("@/lib/services/student.service", () => ({
  deleteStudent: vi.fn(),
  editStudent: vi.fn(),
}));

import { GET } from "@/app/api/admin/students/[studentId]/route";
import { USER_ROLE } from "@/lib/constants/roles";
import { ForbiddenError } from "@/lib/errors/app-error";

describe("ADMIN student detail route", () => {
  beforeEach(() => {
    mocks.requireApiRole.mockReset();
    mocks.getAdminStudentDetail.mockReset();
  });

  it("rejects STUDENT access before returning topic analytics", async () => {
    mocks.requireApiRole.mockRejectedValue(new ForbiddenError());
    const studentId = "507f1f77bcf86cd799439011";

    const response = await GET(
      new Request(`http://localhost/api/admin/students/${studentId}`),
      { params: Promise.resolve({ studentId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requireApiRole).toHaveBeenCalledWith(USER_ROLE.ADMIN);
    expect(mocks.getAdminStudentDetail).not.toHaveBeenCalled();
  });
});
