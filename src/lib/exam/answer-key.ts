import { PART_TWO_STATEMENTS } from "@/lib/constants/exam";
import type {
  AnyExamAnswerKey,
  DynamicExamAnswerKey,
  DynamicExamAnswerKeyAnswer,
  ExamAnswerKey,
  PartTwoAnswer,
} from "@/types/exam";

export function isDynamicExamAnswerKey(
  answerKey: AnyExamAnswerKey,
): answerKey is DynamicExamAnswerKey {
  return "answersByQuestionId" in answerKey;
}

function isPartTwoAnswer(
  answer: DynamicExamAnswerKeyAnswer,
): answer is PartTwoAnswer {
  return typeof answer === "object";
}

function areDynamicAnswersEqual(
  left: DynamicExamAnswerKeyAnswer,
  right: DynamicExamAnswerKeyAnswer | undefined,
): boolean {
  if (right === undefined || typeof left !== typeof right) {
    return false;
  }

  if (!isPartTwoAnswer(left) || !isPartTwoAnswer(right)) {
    return left === right;
  }

  return PART_TWO_STATEMENTS.every(
    (statement) => left[statement] === right[statement],
  );
}

export function areExamAnswerKeysEqual(
  left: AnyExamAnswerKey,
  right: AnyExamAnswerKey,
): boolean {
  if (isDynamicExamAnswerKey(left) || isDynamicExamAnswerKey(right)) {
    if (!isDynamicExamAnswerKey(left) || !isDynamicExamAnswerKey(right)) {
      return false;
    }

    const leftQuestionIds = Object.keys(left.answersByQuestionId);
    const rightQuestionIds = Object.keys(right.answersByQuestionId);
    return (
      leftQuestionIds.length === rightQuestionIds.length &&
      leftQuestionIds.every((questionId) =>
        areDynamicAnswersEqual(
          left.answersByQuestionId[questionId],
          right.answersByQuestionId[questionId],
        ),
      )
    );
  }

  return (
    left.partOne.length === right.partOne.length &&
    left.partOne.every((answer, index) => answer === right.partOne[index]) &&
    left.partTwo.length === right.partTwo.length &&
    left.partTwo.every((answer, index) =>
      PART_TWO_STATEMENTS.every(
        (statement) => answer[statement] === right.partTwo[index]?.[statement],
      ),
    ) &&
    left.partThree.length === right.partThree.length &&
    left.partThree.every((answer, index) => answer === right.partThree[index])
  );
}

export function cloneExamAnswerKey(answerKey: ExamAnswerKey): ExamAnswerKey;
export function cloneExamAnswerKey(
  answerKey: DynamicExamAnswerKey,
): DynamicExamAnswerKey;
export function cloneExamAnswerKey(
  answerKey: AnyExamAnswerKey,
): AnyExamAnswerKey;
export function cloneExamAnswerKey(
  answerKey: AnyExamAnswerKey,
): AnyExamAnswerKey {
  if (!isDynamicExamAnswerKey(answerKey)) {
    return {
      partOne: [...answerKey.partOne],
      partTwo: answerKey.partTwo.map((answer) => ({ ...answer })),
      partThree: [...answerKey.partThree],
    };
  }

  return {
    answersByQuestionId: Object.fromEntries(
      Object.entries(answerKey.answersByQuestionId).map(
        ([questionId, answer]) => [
          questionId,
          typeof answer === "object" ? { ...answer } : answer,
        ],
      ),
    ),
  };
}
