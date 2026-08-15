import { describe, expect, it } from "vitest";

import { areExamAnswerKeysEqual } from "@/lib/exam/answer-key";
import type { ExamAnswerKey } from "@/types/exam";

function createAnswerKey(): ExamAnswerKey {
  return {
    partOne: Array.from({ length: 12 }, () => "A" as const),
    partTwo: Array.from({ length: 4 }, () => ({
      a: true,
      b: false,
      c: true,
      d: false,
    })),
    partThree: ["1", "2", "3", "4", "5", "6"],
  };
}

describe("answer-key equality", () => {
  it("compares equivalent answer keys structurally", () => {
    expect(areExamAnswerKeysEqual(createAnswerKey(), createAnswerKey())).toBe(
      true,
    );
  });

  it("detects a changed answer", () => {
    const current = createAnswerKey();
    const corrected = createAnswerKey();
    corrected.partTwo[0].c = false;

    expect(areExamAnswerKeysEqual(current, corrected)).toBe(false);
  });
});
