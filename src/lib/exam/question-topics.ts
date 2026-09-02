import { EXAM_STRUCTURE } from "@/lib/constants/exam";
import type { ExamQuestionTopicIds } from "@/types/exam";

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

export function getUniqueExamTopicIds(
  questionTopicIds: ExamQuestionTopicIds,
): string[] {
  return [
    ...new Set([
      ...questionTopicIds.partOne.flat(),
      ...questionTopicIds.partTwo.flat(),
      ...questionTopicIds.partThree.flat(),
    ]),
  ];
}
