import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiRole: vi.fn(),
  updateManualEssayGrading: vi.fn(),
  getAdminAttemptDetail: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireApiRole: mocks.requireApiRole,
}));

vi.mock("@/lib/services/exam-attempt.service", () => ({
  updateManualEssayGrading: mocks.updateManualEssayGrading,
}));

vi.mock("@/lib/services/reporting.service", () => ({
  getAdminAttemptDetail: mocks.getAdminAttemptDetail,
}));

import { PATCH } from "@/app/api/admin/results/[attemptId]/route";
import { ForbiddenError } from "@/lib/errors/app-error";
import { USER_ROLE } from "@/lib/constants/roles";

describe("ADMIN manual essay grading route", () => {
  const attemptId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mocks.requireApiRole.mockReset();
    mocks.updateManualEssayGrading.mockReset();
    mocks.getAdminAttemptDetail.mockReset();
  });

  it("rejects STUDENT access before grading", async () => {
    mocks.requireApiRole.mockRejectedValue(new ForbiddenError());

    const response = await PATCH(
      new Request(`http://localhost/api/admin/results/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE_DRAFT",
          expectedRevision: 0,
          manualEssayScores: [],
        }),
      }),
      { params: Promise.resolve({ attemptId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requireApiRole).toHaveBeenCalledWith(USER_ROLE.ADMIN);
    expect(mocks.updateManualEssayGrading).not.toHaveBeenCalled();
  });

  it("rejects client-supplied totals", async () => {
    mocks.requireApiRole.mockResolvedValue({
      id: "admin-id",
      role: USER_ROLE.ADMIN,
    });

    const response = await PATCH(
      new Request(`http://localhost/api/admin/results/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "FINALIZE",
          expectedRevision: 0,
          manualEssayScores: [{ questionId: "essay", scoreHundredths: 100 }],
          totalScoreHundredths: 1000,
        }),
      }),
      { params: Promise.resolve({ attemptId }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.updateManualEssayGrading).not.toHaveBeenCalled();
  });

  it("requires an explicit correction confirmation", async () => {
    mocks.requireApiRole.mockResolvedValue({
      id: "admin-id",
      role: USER_ROLE.ADMIN,
    });

    const response = await PATCH(
      new Request(`http://localhost/api/admin/results/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CORRECT",
          expectedRevision: 2,
          manualEssayScores: [{ questionId: "essay", scoreHundredths: 100 }],
        }),
      }),
      { params: Promise.resolve({ attemptId }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.updateManualEssayGrading).not.toHaveBeenCalled();
  });
});
