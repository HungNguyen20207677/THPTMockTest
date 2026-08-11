import { z } from "zod";

import { EXAM_STRUCTURE, PART_ONE_CHOICES } from "@/lib/constants/exam";
import {
  isEmptyShortAnswerSlots,
  shortAnswerSlotsToCanonicalValue,
} from "@/lib/exam/short-answer";
import { shortAnswerSlotsSchema } from "@/lib/validations/exam";
import type { AttemptAnswers } from "@/types/exam-attempt";

const attemptPartTwoAnswerSchema = z.strictObject({
  a: z.boolean().nullable(),
  b: z.boolean().nullable(),
  c: z.boolean().nullable(),
  d: z.boolean().nullable(),
});

const attemptShortAnswerSchema = shortAnswerSlotsSchema.refine(
  (slots) =>
    isEmptyShortAnswerSlots(slots) ||
    shortAnswerSlotsToCanonicalValue(slots) !== null,
  "Đáp án ngắn phải để trống hoàn toàn hoặc có giá trị hợp lệ.",
);

export const attemptAnswersSchema: z.ZodType<AttemptAnswers> = z.strictObject({
  partOne: z
    .array(z.enum(PART_ONE_CHOICES).nullable())
    .length(EXAM_STRUCTURE.partOneQuestions),
  partTwo: z
    .array(attemptPartTwoAnswerSchema)
    .length(EXAM_STRUCTURE.partTwoQuestions),
  partThree: z
    .array(attemptShortAnswerSchema)
    .length(EXAM_STRUCTURE.partThreeQuestions),
});

export const attemptAnswersRequestSchema = z.strictObject({
  answers: attemptAnswersSchema,
});

export type AttemptAnswersRequest = z.infer<typeof attemptAnswersRequestSchema>;
