import {
  BUILT_IN_THPT_EXAM_STRUCTURE_TEMPLATE_NAME,
  EXAM_STRUCTURE_QUESTION_TYPE,
} from "@/lib/constants/exam-structure-template";
import type {
  ExamStructureQuestionType,
  ExamStructureSection,
  ExamStructureSnapshot,
} from "@/types/exam-structure-template";

function createQuestions(
  sectionId: string,
  type: ExamStructureQuestionType,
  count: number,
  maxScoreHundredths: number,
) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${sectionId}-question-${index + 1}`,
    type,
    maxScoreHundredths,
  }));
}

const builtInThptSections: ExamStructureSection[] = [
  {
    id: "part-one",
    title: "Phần I",
    questions: createQuestions(
      "part-one",
      EXAM_STRUCTURE_QUESTION_TYPE.SINGLE_CHOICE,
      12,
      25,
    ),
  },
  {
    id: "part-two",
    title: "Phần II",
    questions: createQuestions(
      "part-two",
      EXAM_STRUCTURE_QUESTION_TYPE.TRUE_FALSE,
      4,
      100,
    ),
  },
  {
    id: "part-three",
    title: "Phần III",
    questions: createQuestions(
      "part-three",
      EXAM_STRUCTURE_QUESTION_TYPE.SHORT_ANSWER,
      6,
      50,
    ),
  },
];

export function cloneExamStructureSnapshot(
  snapshot: ExamStructureSnapshot,
): ExamStructureSnapshot {
  return {
    sections: snapshot.sections.map((section) => ({
      id: section.id,
      title: section.title,
      questions: section.questions.map((question) => ({ ...question })),
    })),
  };
}

export function createExamStructureSnapshot(
  source: Pick<ExamStructureSnapshot, "sections">,
): ExamStructureSnapshot {
  return cloneExamStructureSnapshot(source);
}

export function createBuiltInThptExamStructureSnapshot(): ExamStructureSnapshot {
  return cloneExamStructureSnapshot({ sections: builtInThptSections });
}

export function createBuiltInThptExamStructureTemplateData() {
  return {
    name: BUILT_IN_THPT_EXAM_STRUCTURE_TEMPLATE_NAME,
    isBuiltIn: true as const,
    ...createBuiltInThptExamStructureSnapshot(),
  };
}

export function resolveExamStructureSnapshot(
  snapshot?: ExamStructureSnapshot,
): ExamStructureSnapshot {
  return snapshot
    ? cloneExamStructureSnapshot(snapshot)
    : createBuiltInThptExamStructureSnapshot();
}

export function getExamStructureTotalScoreHundredths(
  structure: Pick<ExamStructureSnapshot, "sections">,
): number {
  return structure.sections.reduce(
    (templateTotal, section) =>
      templateTotal +
      section.questions.reduce(
        (sectionTotal, question) => sectionTotal + question.maxScoreHundredths,
        0,
      ),
    0,
  );
}

export function getExamStructureQuestionCount(
  structure: Pick<ExamStructureSnapshot, "sections">,
): number {
  return structure.sections.reduce(
    (total, section) => total + section.questions.length,
    0,
  );
}
