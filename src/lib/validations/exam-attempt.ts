import { z } from "zod";

export const attemptIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Mã lượt làm bài không hợp lệ.")
  .transform((attemptId) => attemptId.toLowerCase());

export const emptyAttemptMutationSchema = z.strictObject({});
