import { PART_TWO_STATEMENTS } from "@/lib/constants/exam";
import type { ExamAnswerKey } from "@/types/exam";

export function areExamAnswerKeysEqual(
  left: ExamAnswerKey,
  right: ExamAnswerKey,
): boolean {
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
