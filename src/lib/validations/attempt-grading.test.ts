import { describe, expect, it } from "vitest";

import { EXAM_STRUCTURE } from "@/lib/constants/exam";
import { createEmptyAttemptAnswers } from "@/lib/exam/attempt-answers";
import { gradeAttemptAnswers } from "@/lib/exam/grading";
import { attemptGradingSnapshotSchema } from "@/lib/validations/attempt-grading";
import type { ExamAnswerKey } from "@/types/exam";

function createAnswerKey(): ExamAnswerKey {
  return {
    partOne: Array.from(
      { length: EXAM_STRUCTURE.partOneQuestions },
      () => "A" as const,
    ),
    partTwo: Array.from({ length: EXAM_STRUCTURE.partTwoQuestions }, () => ({
      a: true,
      b: false,
      c: true,
      d: false,
    })),
    partThree: ["1", "2", "3", "4", "5", "6"],
  };
}

describe("attempt grading snapshot validation", () => {
  it("accepts a snapshot produced by the authoritative grader", () => {
    const grading = gradeAttemptAnswers(
      createEmptyAttemptAnswers(),
      createAnswerKey(),
    );

    expect(attemptGradingSnapshotSchema.safeParse(grading).success).toBe(true);
  });

  it("rejects contradictory totals and Part II details", () => {
    const grading = gradeAttemptAnswers(
      createEmptyAttemptAnswers(),
      createAnswerKey(),
    );
    const contradictory = structuredClone(grading);
    contradictory.totalScoreHundredths = 1000;
    contradictory.partTwo[0].correctStatementCount = 4;
    contradictory.partTwo[0].scoreHundredths = 100;

    expect(attemptGradingSnapshotSchema.safeParse(contradictory).success).toBe(
      false,
    );
  });
});
