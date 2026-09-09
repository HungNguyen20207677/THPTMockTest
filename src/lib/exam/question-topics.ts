import { EXAM_STRUCTURE } from "@/lib/constants/exam";
import { resolveExamStructureSnapshot } from "@/lib/exam/structure";
import type { ExamQuestionTopic, ExamQuestionTopicIds } from "@/types/exam";
import type {
  ExamStructureQuestionType,
  ExamStructureSnapshot,
} from "@/types/exam-structure-template";

export interface ExamQuestionTopicAssignment {
  sectionId: string;
  sectionTitle: string;
  questionId: string;
  questionNumber: number;
  questionType: ExamStructureQuestionType;
  maxScoreHundredths: number;
  topicIds: string[];
}

export interface ExamQuestionTopicsSource {
  questionTopicIds: ExamQuestionTopicIds;
  questionTopics?: ExamQuestionTopic[];
  structureSnapshot?: ExamStructureSnapshot;
}

export function createEmptyQuestionTopicIds(): ExamQuestionTopicIds {
  return {
    partOne: Array.from({ length: EXAM_STRUCTURE.partOneQuestions }, () => []),
    partTwo: Array.from({ length: EXAM_STRUCTURE.partTwoQuestions }, () => []),
    partThree: Array.from(
      { length: EXAM_STRUCTURE.partThreeQuestions },
      () => [],
    ),
  };
}

export function createEmptyQuestionTopics(
  structure: Pick<ExamStructureSnapshot, "sections">,
): ExamQuestionTopic[] {
  return structure.sections.flatMap((section) =>
    section.questions.map((question) => ({
      questionId: question.id,
      topicIds: [],
    })),
  );
}

export function normalizeExamQuestionTopics(
  structure: Pick<ExamStructureSnapshot, "sections">,
  questionTopics: ExamQuestionTopic[] = [],
): ExamQuestionTopic[] {
  const topicIdsByQuestionId = new Map(
    questionTopics.map(({ questionId, topicIds }) => [
      questionId,
      [...new Set(topicIds)],
    ]),
  );

  return structure.sections.flatMap((section) =>
    section.questions.map((question) => ({
      questionId: question.id,
      topicIds: topicIdsByQuestionId.get(question.id) ?? [],
    })),
  );
}

export function getExamQuestionTopicAssignments({
  questionTopicIds,
  questionTopics,
  structureSnapshot,
}: ExamQuestionTopicsSource): ExamQuestionTopicAssignment[] {
  const structure = resolveExamStructureSnapshot(structureSnapshot);
  const dynamicTopicIdsByQuestionId = new Map(
    questionTopics?.map(({ questionId, topicIds }) => [
      questionId,
      [...new Set(topicIds)],
    ]) ?? [],
  );
  const legacySections = [
    questionTopicIds.partOne,
    questionTopicIds.partTwo,
    questionTopicIds.partThree,
  ];

  return structure.sections.flatMap((section, sectionIndex) =>
    section.questions.map((question, questionIndex) => ({
      sectionId: section.id,
      sectionTitle: section.title,
      questionId: question.id,
      questionNumber: questionIndex + 1,
      questionType: question.type,
      maxScoreHundredths: question.maxScoreHundredths,
      topicIds: structureSnapshot
        ? (dynamicTopicIdsByQuestionId.get(question.id) ?? [])
        : [...new Set(legacySections[sectionIndex]?.[questionIndex] ?? [])],
    })),
  );
}

export function getUniqueExamTopicIds(
  source: ExamQuestionTopicIds | ExamQuestionTopicsSource,
): string[] {
  if ("partOne" in source) {
    return [
      ...new Set([
        ...source.partOne.flat(),
        ...source.partTwo.flat(),
        ...source.partThree.flat(),
      ]),
    ];
  }

  return [
    ...new Set(
      getExamQuestionTopicAssignments(source).flatMap(
        (question) => question.topicIds,
      ),
    ),
  ];
}
