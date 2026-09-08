import { describe, expect, it } from "vitest";

import {
  BUILT_IN_THPT_EXAM_STRUCTURE_TEMPLATE_NAME,
  EXAM_STRUCTURE_QUESTION_TYPE,
  EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS,
} from "@/lib/constants/exam-structure-template";
import {
  createBuiltInThptExamStructureSnapshot,
  createBuiltInThptExamStructureTemplateData,
  createExamStructureSnapshot,
  getExamStructureTotalScoreHundredths,
  resolveExamStructureSnapshot,
} from "@/lib/exam/structure";
import type { ExamStructureSection } from "@/types/exam-structure-template";

describe("Exam structure foundation", () => {
  it("defines the current THPT structure as the built-in template", () => {
    const template = createBuiltInThptExamStructureTemplateData();

    expect(template.name).toBe(BUILT_IN_THPT_EXAM_STRUCTURE_TEMPLATE_NAME);
    expect(template.isBuiltIn).toBe(true);
    expect(template.sections.map((section) => section.title)).toEqual([
      "Phần I",
      "Phần II",
      "Phần III",
    ]);
    expect(
      template.sections.map((section) => ({
        count: section.questions.length,
        type: section.questions[0]?.type,
        maxScoreHundredths: section.questions[0]?.maxScoreHundredths,
      })),
    ).toEqual([
      {
        count: 12,
        type: EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
        maxScoreHundredths: 25,
      },
      {
        count: 4,
        type: EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
        maxScoreHundredths: 100,
      },
      {
        count: 6,
        type: EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
        maxScoreHundredths: 50,
      },
    ]);

    const sectionIds = template.sections.map((section) => section.id);
    const questionIds = template.sections.flatMap((section) =>
      section.questions.map((question) => question.id),
    );
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    expect(new Set(questionIds).size).toBe(questionIds.length);
  });

  it("totals the built-in THPT structure to exactly 1000 hundredths", () => {
    expect(
      getExamStructureTotalScoreHundredths(
        createBuiltInThptExamStructureSnapshot(),
      ),
    ).toBe(EXAM_STRUCTURE_TOTAL_SCORE_HUNDREDTHS);
  });

  it("keeps legacy Exams on the current fixed 12/4/6 structure", () => {
    const legacyStructure = resolveExamStructureSnapshot(undefined);

    expect(
      legacyStructure.sections.map((section) => section.questions.length),
    ).toEqual([12, 4, 6]);
    expect(legacyStructure).toEqual(createBuiltInThptExamStructureSnapshot());
  });

  it("creates a snapshot independent from later template mutation", () => {
    const sections: ExamStructureSection[] = [
      {
        id: "section-1",
        title: "Phần ban đầu",
        questions: [
          {
            id: "question-1",
            type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
            maxScoreHundredths: 1000,
          },
        ],
      },
    ];
    const snapshot = createExamStructureSnapshot({ sections });

    sections[0].title = "Phần đã đổi";
    sections[0].questions[0].maxScoreHundredths = 500;
    sections.push({
      id: "section-2",
      title: "Phần mới",
      questions: [],
    });

    expect(snapshot).toEqual({
      sections: [
        {
          id: "section-1",
          title: "Phần ban đầu",
          questions: [
            {
              id: "question-1",
              type: EXAM_STRUCTURE_QUESTION_TYPE.ESSAY_IMAGE,
              maxScoreHundredths: 1000,
            },
          ],
        },
      ],
    });
  });
});
