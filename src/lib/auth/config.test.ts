import type { NextAuthConfig } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const captured: { config: unknown } = { config: null };

  return {
    captured,
    authenticateUser: vi.fn(),
    findActiveAuthUser: vi.fn(),
    credentials: vi.fn((options: unknown) => options),
    nextAuth: vi.fn((config: unknown) => {
      captured.config = config;

      return {
        handlers: { GET: vi.fn(), POST: vi.fn() },
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      };
    }),
  };
});

vi.mock("next-auth", () => ({
  default: harness.nextAuth,
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: harness.credentials,
}));

vi.mock("@/lib/services/auth.service", () => ({
  authenticateUser: harness.authenticateUser,
  findActiveAuthUser: harness.findActiveAuthUser,
}));

import "@/lib/auth";

function getAuthConfig(): NextAuthConfig {
  return harness.captured.config as NextAuthConfig;
}

describe("Auth.js callbacks", () => {
  beforeEach(() => {
    harness.findActiveAuthUser.mockReset();
  });

  it("invalidates a JWT after the account session version changes", async () => {
    const jwtCallback = getAuthConfig().callbacks?.jwt;

    if (!jwtCallback) {
      throw new Error("JWT callback is not configured.");
    }

    harness.findActiveAuthUser.mockResolvedValue({
      id: "student-id",
      username: "student",
      fullName: "Nguyen Van An",
      role: "STUDENT",
      sessionVersion: 2,
    });

    const result = await jwtCallback({
      token: {
        id: "student-id",
        username: "student",
        fullName: "Nguyen Van An",
        role: "STUDENT",
        sessionVersion: 1,
      },
    } as Parameters<typeof jwtCallback>[0]);

    expect(result).toBeNull();
  });

  it("returns only the required user fields in the client session", async () => {
    const sessionCallback = getAuthConfig().callbacks?.session;

    if (!sessionCallback) {
      throw new Error("Session callback is not configured.");
    }

    const result = await sessionCallback({
      session: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          id: "student-id",
          username: "student",
          fullName: "Nguyen Van An",
          role: "STUDENT",
        },
      },
      token: {
        id: "student-id",
        username: "student",
        fullName: "Nguyen Van An",
        role: "STUDENT",
        sessionVersion: 3,
      },
    } as Parameters<typeof sessionCallback>[0]);

    expect(result).toEqual({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "student-id",
        username: "student",
        fullName: "Nguyen Van An",
        role: "STUDENT",
      },
    });
    expect(result.user).not.toHaveProperty("sessionVersion");
    expect(result.user).not.toHaveProperty("passwordHash");
  });
});
