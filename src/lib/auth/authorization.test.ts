import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

import { requireApiRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

describe("requireApiRole", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
  });

  it("rejects an unauthenticated request", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(requireApiRole(USER_ROLE.ADMIN)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      statusCode: 401,
    });
  });

  it("rejects a current STUDENT from an ADMIN endpoint", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "student-id",
        username: "student",
        fullName: "Nguyen Van An",
        role: USER_ROLE.STUDENT,
      },
      expires: "2099-01-01T00:00:00.000Z",
    });

    await expect(requireApiRole(USER_ROLE.ADMIN)).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });
});
