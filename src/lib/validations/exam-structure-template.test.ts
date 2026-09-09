import { describe, expect, it } from "vitest";

import { EXAM_STRUCTURE_QUESTION_TYPE } from "@/lib/constants/exam-structure-template";
import {
  examStructureTemplateEditorSchema,
  upsertExamStructureTemplateSchema,
} from "@/lib/validations/exam-structure-template";

function createValidTemplateInput() {
  return {
    name: "Mẫu kiểm tra chương",
    sections: [
      {
        id: "section-1",
        title: "Phần I",
        questions: [
          {
            id: "question-1",
            type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
            maxScoreHundredths: 100,
          },
          {
            id: "question-2",
            type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
            maxScoreHundredths: 200,
          },
          {
            id: "question-3",
            type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
            maxScoreHundredths: 300,
          },
          {
            id: "question-4",
            type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
            maxScoreHundredths: 400,
          },
        ],
      },
    ],
  };
}

describe("Exam structure template validation", () => {
  it("accepts a custom template containing all four supported question types", () => {
    const result = upsertExamStructureTemplateSchema.parse({
      ...createValidTemplateInput(),
      name: "  Mẫu đủ bốn loại câu hỏi  ",
    });

    expect(result.name).toBe("Mẫu đủ bốn loại câu hỏi");
    expect(
      result.sections[0].questions.map((question) => question.type),
    ).toEqual([
      EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
      EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
      EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
      EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
    ]);
  });

  it("converts any valid two-decimal point value to exact hundredths", () => {
    const result = examStructureTemplateEditorSchema.parse({
      name: "Mẫu điểm thập phân",
      sections: [
        {
          id: "section-1",
          title: "Phần I",
          questions: [
            {
              id: "question-1",
              type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
              maxScore: "0,07",
            },
            {
              id: "question-2",
              type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
              maxScore: "0.20",
            },
            {
              id: "question-3",
              type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
              maxScore: "0.29",
            },
            {
              id: "question-4",
              type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
              maxScore: "9.44",
            },
          ],
        },
      ],
    });

    expect(
      result.sections[0].questions.map(
        (question) => question.maxScoreHundredths,
      ),
    ).toEqual([7, 20, 29, 944]);
  });

  it("rejects a TRUE_FALSE maximum score that cannot use exact partial scoring", () => {
    const input = createValidTemplateInput();
    input.sections[0].questions[1].maxScoreHundredths = 190;
    input.sections[0].questions[3].maxScoreHundredths = 410;

    const result = upsertExamStructureTemplateSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["sections", 0, "questions", 1, "maxScoreHundredths"],
          }),
        ]),
      );
    }
  });

  it("rejects an unsupported question type", () => {
    const input = createValidTemplateInput();
    const invalidInput = {
      ...input,
      sections: [
        {
          ...input.sections[0],
          questions: input.sections[0].questions.map((question, index) =>
            index === 0 ? { ...question, type: "MULTIPLE_CHOICE" } : question,
          ),
        },
      ],
    };

    expect(
      upsertExamStructureTemplateSchema.safeParse(invalidInput).success,
    ).toBe(false);
  });

  it("rejects an empty structure or a section without questions", () => {
    expect(
      upsertExamStructureTemplateSchema.safeParse({
        name: "Mẫu rỗng",
        sections: [],
      }).success,
    ).toBe(false);
    expect(
      upsertExamStructureTemplateSchema.safeParse({
        name: "Mẫu có phần rỗng",
        sections: [{ id: "section-1", title: "Phần I", questions: [] }],
      }).success,
    ).toBe(false);
  });

  it("rejects a non-positive maximum score", () => {
    const input = createValidTemplateInput();
    input.sections[0].questions[0].maxScoreHundredths = 0;

    const result = upsertExamStructureTemplateSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["sections", 0, "questions", 0, "maxScoreHundredths"],
          }),
        ]),
      );
    }
  });

  it("rejects a total score other than 1000 hundredths", () => {
    const input = createValidTemplateInput();
    input.sections[0].questions[0].maxScoreHundredths = 99;

    const result = upsertExamStructureTemplateSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Tổng điểm của mẫu cấu trúc phải bằng đúng 10,00 điểm.",
          }),
        ]),
      );
    }
  });

  it("rejects duplicate section and question IDs within a template", () => {
    const duplicateSections = {
      name: "Mẫu trùng phần",
      sections: [
        {
          id: "same-section",
          title: "Phần I",
          questions: [
            {
              id: "question-1",
              type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
              maxScoreHundredths: 500,
            },
          ],
        },
        {
          id: "same-section",
          title: "Phần II",
          questions: [
            {
              id: "question-2",
              type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
              maxScoreHundredths: 500,
            },
          ],
        },
      ],
    };
    const duplicateQuestions = {
      ...duplicateSections,
      name: "Mẫu trùng câu",
      sections: duplicateSections.sections.map((section, index) => ({
        ...section,
        id: `section-${index + 1}`,
        questions: section.questions.map((question) => ({
          ...question,
          id: "same-question",
        })),
      })),
    };

    expect(
      upsertExamStructureTemplateSchema.safeParse(duplicateSections).success,
    ).toBe(false);
    expect(
      upsertExamStructureTemplateSchema.safeParse(duplicateQuestions).success,
    ).toBe(false);
  });
});
