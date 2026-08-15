import { describe, expect, it } from "vitest";

import { startAttemptMutationSchema } from "@/lib/validations/exam-attempt";

describe("start attempt validation", () => {
  it("accepts a new start or one exact attempt to resume", () => {
    expect(startAttemptMutationSchema.safeParse({}).success).toBe(true);
    expect(
      startAttemptMutationSchema.safeParse({
        resumeAttemptId: "507f1f77bcf86cd799439011",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed resume attempt IDs", () => {
    expect(
      startAttemptMutationSchema.safeParse({ resumeAttemptId: "attempt-id" })
        .success,
    ).toBe(false);
  });
});
