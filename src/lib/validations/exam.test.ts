import { describe, expect, it } from "vitest";

import {
  EXAM_STATUS,
  EXAM_STRUCTURE,
  PART3_INPUT_MODE,
} from "@/lib/constants/exam";
import { examUpsertSchema } from "@/lib/validations/exam";

function createValidExamInput() {
  return {
    title: "Đề thi thử Toán số 1",
    description: "Đề luyện tập",
    status: EXAM_STATUS.DRAFT,
    settings: {
      allowRetake: true,
      showScoreAfterSubmission: true,
      showAnswersAfterSubmission: false,
    },
    answerKey: {
      partOne: Array.from(
        { length: EXAM_STRUCTURE.partOneQuestions },
        () => "A",
      ),
      partTwo: Array.from({ length: EXAM_STRUCTURE.partTwoQuestions }, () => ({
        a: true,
        b: false,
        c: true,
        d: false,
      })),
      partThree: Array.from(
        { length: EXAM_STRUCTURE.partThreeQuestions },
        () => "0.5",
      ),
    },
  };
}

describe("exam answer-key validation", () => {
  it("defaults legacy input without a Part III mode to BUBBLE", () => {
    const parsed = examUpsertSchema.parse(createValidExamInput());

    expect(parsed.part3InputMode).toBe(PART3_INPUT_MODE.BUBBLE);
  });

  it("accepts TEXT and rejects unknown Part III input modes", () => {
    expect(
      examUpsertSchema.safeParse({
        ...createValidExamInput(),
        part3InputMode: PART3_INPUT_MODE.TEXT,
      }).success,
    ).toBe(true);
    expect(
      examUpsertSchema.safeParse({
        ...createValidExamInput(),
        part3InputMode: "FORMULA",
      }).success,
    ).toBe(false);
  });

  it("accepts exactly 12 valid Part I answers", () => {
    expect(examUpsertSchema.safeParse(createValidExamInput()).success).toBe(
      true,
    );

    const invalid = createValidExamInput();
    invalid.answerKey.partOne.pop();
    expect(examUpsertSchema.safeParse(invalid).success).toBe(false);
  });

  it("requires exactly four Part II questions with four booleans", () => {
    const invalidCount = createValidExamInput();
    invalidCount.answerKey.partTwo.pop();

    const invalidStatement = createValidExamInput();
    const malformedQuestion = { a: true, b: false, c: true };
    invalidStatement.answerKey.partTwo[0] = malformedQuestion as {
      a: boolean;
      b: boolean;
      c: boolean;
      d: boolean;
    };

    expect(examUpsertSchema.safeParse(invalidCount).success).toBe(false);
    expect(examUpsertSchema.safeParse(invalidStatement).success).toBe(false);
  });

  it("requires exactly six valid canonical Part III answers", () => {
    const invalidCount = createValidExamInput();
    invalidCount.answerKey.partThree.pop();

    const invalidAnswer = createValidExamInput();
    invalidAnswer.answerKey.partThree[0] = "12.";

    expect(examUpsertSchema.safeParse(invalidCount).success).toBe(false);
    expect(examUpsertSchema.safeParse(invalidAnswer).success).toBe(false);
  });
});
