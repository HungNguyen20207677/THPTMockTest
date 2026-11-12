import { z } from "zod";

import { EXAM_STRUCTURE_ITEM_ID_MAX_LENGTH } from "@/lib/constants/exam-structure-template";

export const attemptIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Mã lượt làm bài không hợp lệ.")
  .transform((attemptId) => attemptId.toLowerCase());

export const emptyAttemptMutationSchema = z.strictObject({});

export const startAttemptMutationSchema = z.strictObject({
  resumeAttemptId: attemptIdSchema.optional(),
});

export const attemptQuestionFlagMutationSchema = z.strictObject({
  questionId: z
    .string()
    .min(1, "Mã câu hỏi là bắt buộc.")
    .max(
      EXAM_STRUCTURE_ITEM_ID_MAX_LENGTH,
      "Mã câu hỏi vượt quá độ dài cho phép.",
    ),
  flagged: z.boolean(),
});
