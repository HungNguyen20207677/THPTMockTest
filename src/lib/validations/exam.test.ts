import { describe, expect, it } from "vitest";

import {
  EXAM_STATUS,
  EXAM_STRUCTURE,
  EXAM_VISIBILITY_MODE,
  PART3_INPUT_MODE,
} from "@/lib/constants/exam";
import {
  examUpsertSchema,
  updateExamRequestSchema,
} from "@/lib/validations/exam";
import { createEmptyQuestionTopicIds } from "@/lib/exam/question-topics";

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
    expect(parsed.visibilityMode).toBe(EXAM_VISIBILITY_MODE.ALL_STUDENTS);
    expect(parsed.assignedStudentIds).toEqual([]);
    expect(parsed.questionTopicIds).toEqual(createEmptyQuestionTopicIds());
  });

  it("supports multiple deduplicated topics across all three question parts", () => {
    const firstTopicId = "64b000000000000000000011";
    const secondTopicId = "64b000000000000000000012";
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partOne[0] = [firstTopicId, secondTopicId, firstTopicId];
    questionTopicIds.partTwo[1] = [secondTopicId];
    questionTopicIds.partThree[5] = [firstTopicId];

    const parsed = examUpsertSchema.parse({
      ...createValidExamInput(),
      questionTopicIds,
    });

    expect(parsed.questionTopicIds.partOne[0]).toEqual([
      firstTopicId,
      secondTopicId,
    ]);
    expect(parsed.questionTopicIds.partTwo[1]).toEqual([secondTopicId]);
    expect(parsed.questionTopicIds.partThree[5]).toEqual([firstTopicId]);
  });

  it("requires one top-level topic list per question in each part", () => {
    const questionTopicIds = createEmptyQuestionTopicIds();
    questionTopicIds.partTwo.pop();

    expect(
      examUpsertSchema.safeParse({
        ...createValidExamInput(),
        questionTopicIds,
      }).success,
    ).toBe(false);
  });

  it("deduplicates selected students and ignores IDs in all-student mode", () => {
    const firstStudentId = "64b000000000000000000001";
    const secondStudentId = "64b000000000000000000002";
    const selected = examUpsertSchema.parse({
      ...createValidExamInput(),
      visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
      assignedStudentIds: [firstStudentId, firstStudentId, secondStudentId],
    });
    const allStudents = examUpsertSchema.parse({
      ...createValidExamInput(),
      visibilityMode: EXAM_VISIBILITY_MODE.ALL_STUDENTS,
      assignedStudentIds: [firstStudentId],
    });

    expect(selected.assignedStudentIds).toEqual([
      firstStudentId,
      secondStudentId,
    ]);
    expect(allStudents.assignedStudentIds).toEqual([]);
  });

  it.each([
    {
      visibilityMode: EXAM_VISIBILITY_MODE.SELECTED_STUDENTS,
    },
    {
      assignedStudentIds: ["64b000000000000000000001"],
    },
  ])("rejects a one-sided assignment payload", (assignment) => {
    expect(
      examUpsertSchema.safeParse({
        ...createValidExamInput(),
        ...assignment,
      }).success,
    ).toBe(false);
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

  it("accepts only an explicit true answer-key correction confirmation", () => {
    const request = {
      exam: {
        ...createValidExamInput(),
        expectedUpdatedAt: "2026-08-10T12:00:00.000Z",
      },
    };

    expect(
      updateExamRequestSchema.safeParse({
        ...request,
        confirmAnswerKeyCorrection: true,
      }).success,
    ).toBe(true);
    expect(
      updateExamRequestSchema.safeParse({
        ...request,
        confirmAnswerKeyCorrection: false,
      }).success,
    ).toBe(false);
  });
});
