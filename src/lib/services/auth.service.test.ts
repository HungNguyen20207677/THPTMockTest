import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compare: vi.fn(),
  findUserById: vi.fn(),
  findUserForAuthentication: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  compare: mocks.compare,
}));

vi.mock("@/lib/db/dao/user.dao", () => ({
  findUserById: mocks.findUserById,
  findUserForAuthentication: mocks.findUserForAuthentication,
}));

import { USER_ROLE } from "@/lib/constants/roles";
import { authenticateUser } from "@/lib/services/auth.service";

describe("authenticateUser", () => {
  beforeEach(() => {
    mocks.compare.mockReset();
    mocks.findUserById.mockReset();
    mocks.findUserForAuthentication.mockReset();
  });

  it("does not authenticate an inactive account", async () => {
    mocks.findUserForAuthentication.mockResolvedValue({
      id: "student-id",
      username: "student",
      fullName: "Nguyen Van An",
      role: USER_ROLE.STUDENT,
      isActive: false,
      sessionVersion: 0,
      passwordHash: "stored-hash",
    });
    mocks.compare.mockResolvedValue(true);

    const result = await authenticateUser({
      username: "STUDENT",
      password: "matkhau123",
    });

    expect(result).toBeNull();
    expect(mocks.findUserForAuthentication).toHaveBeenCalledWith("student");
    expect(mocks.compare).toHaveBeenCalledOnce();
  });

  it("returns only safe session data for an active account", async () => {
    mocks.findUserForAuthentication.mockResolvedValue({
      id: "student-id",
      username: "student",
      fullName: "Nguyen Van An",
      role: USER_ROLE.STUDENT,
      isActive: true,
      sessionVersion: 3,
      passwordHash: "stored-hash",
    });
    mocks.compare.mockResolvedValue(true);

    const result = await authenticateUser({
      username: "student",
      password: "matkhau123",
    });

    expect(result).toEqual({
      id: "student-id",
      username: "student",
      fullName: "Nguyen Van An",
      role: USER_ROLE.STUDENT,
      sessionVersion: 3,
    });
    expect(result).not.toHaveProperty("passwordHash");
  });
});
