import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiRole: vi.fn(),
  bulkDeleteStudents: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireApiRole: mocks.requireApiRole,
}));
vi.mock("@/lib/services/bulk-deletion.service", () => ({
  bulkDeleteStudents: mocks.bulkDeleteStudents,
}));

import { POST } from "@/app/api/admin/students/bulk-delete/route";
import { USER_ROLE } from "@/lib/constants/roles";
import { ForbiddenError } from "@/lib/errors/app-error";

const studentId = "64b000000000000000000001";
const admin = {
  id: "64b000000000000000000099",
  username: "admin",
  fullName: "Admin",
  role: USER_ROLE.ADMIN,
};

function request(items: Array<{ id: string }>) {
  return new Request("http://localhost/api/admin/students/bulk-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

describe("student bulk-delete route", () => {
  beforeEach(() => {
    mocks.requireApiRole.mockReset();
    mocks.bulkDeleteStudents.mockReset();
  });

  it("requires ADMIN before invoking any destructive operation", async () => {
    mocks.requireApiRole.mockRejectedValue(new ForbiddenError());

    const response = await POST(request([{ id: studentId }]));

    expect(response.status).toBe(403);
    expect(mocks.requireApiRole).toHaveBeenCalledWith(USER_ROLE.ADMIN);
    expect(mocks.bulkDeleteStudents).not.toHaveBeenCalled();
  });

  it("passes only the validated selected IDs to the bulk service", async () => {
    mocks.requireApiRole.mockResolvedValue(admin);
    mocks.bulkDeleteStudents.mockResolvedValue({
      requestedCount: 1,
      deletedCount: 1,
      rejectedCount: 0,
      failedCount: 0,
      mediaCleanupIncompleteCount: 0,
      items: [{ id: studentId, status: "DELETED" }],
    });

    const response = await POST(request([{ id: studentId.toUpperCase() }]));

    expect(response.status).toBe(200);
    expect(mocks.bulkDeleteStudents).toHaveBeenCalledWith(admin, {
      items: [{ id: studentId }],
    });
  });
});
