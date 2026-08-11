import { z } from "zod";

import { TERMINAL_EXAM_ATTEMPT_STATUSES } from "@/lib/constants/exam-attempt";
import { examIdSchema } from "@/lib/validations/exam";
import { studentIdSchema } from "@/lib/validations/user";

const pageSchema = z.coerce
  .number<number>()
  .int("Số trang phải là số nguyên.")
  .min(1, "Số trang phải lớn hơn hoặc bằng 1.")
  .max(10_000, "Số trang không được vượt quá 10.000.")
  .default(1);
const pageSizeSchema = z.coerce
  .number<number>()
  .int("Số kết quả mỗi trang phải là số nguyên.")
  .min(1, "Số kết quả mỗi trang phải lớn hơn hoặc bằng 1.")
  .max(100, "Mỗi trang không được vượt quá 100 kết quả.")
  .default(20);

export const paginationQuerySchema = z.strictObject({
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const adminResultQuerySchema = paginationQuerySchema.extend({
  studentId: studentIdSchema.optional(),
  examId: examIdSchema.optional(),
  status: z.enum(TERMINAL_EXAM_ATTEMPT_STATUSES).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type AdminResultQuery = z.infer<typeof adminResultQuerySchema>;
