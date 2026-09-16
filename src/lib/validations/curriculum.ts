import { z } from "zod";

import {
  CHAPTER_NAME_MAX_LENGTH,
  GRADE_NAME_MAX_LENGTH,
} from "@/lib/constants/curriculum";
import {
  cleanCurriculumName,
  normalizeCurriculumName,
} from "@/lib/utils/topic-name";

function createNameSchema(label: "khối" | "chương", maxLength: number) {
  return z
    .string()
    .transform(cleanCurriculumName)
    .pipe(
      z
        .string()
        .min(1, `Tên ${label} là bắt buộc.`)
        .max(maxLength, `Tên ${label} không được vượt quá ${maxLength} ký tự.`),
    )
    .refine(
      (name) => normalizeCurriculumName(name).length <= maxLength,
      `Tên ${label} không được vượt quá ${maxLength} ký tự sau khi chuẩn hóa.`,
    );
}

export const gradeIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Mã khối không hợp lệ.")
  .transform((gradeId) => gradeId.toLowerCase());

export const chapterIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Mã chương không hợp lệ.")
  .transform((chapterId) => chapterId.toLowerCase());

export const gradeNameSchema = createNameSchema("khối", GRADE_NAME_MAX_LENGTH);
export const chapterNameSchema = createNameSchema(
  "chương",
  CHAPTER_NAME_MAX_LENGTH,
);
export const curriculumSortOrderSchema = z
  .number()
  .int("Thứ tự hiển thị phải là số nguyên.")
  .safe("Thứ tự hiển thị không hợp lệ.");

export const createGradeSchema = z.strictObject({
  name: gradeNameSchema,
  sortOrder: curriculumSortOrderSchema,
});

export const updateGradeSchema = createGradeSchema.extend({
  expectedUpdatedAt: z.string().datetime(),
});

export const deleteGradeSchema = z.strictObject({
  expectedUpdatedAt: z.string().datetime(),
});

export const createChapterSchema = z.strictObject({
  gradeId: gradeIdSchema,
  name: chapterNameSchema,
});

export const updateChapterSchema = createChapterSchema.extend({
  expectedUpdatedAt: z.string().datetime(),
});

export const deleteChapterSchema = z.strictObject({
  expectedUpdatedAt: z.string().datetime(),
});

export const listChaptersQuerySchema = z.strictObject({
  gradeId: gradeIdSchema.optional(),
});

export type CreateGradeInput = z.output<typeof createGradeSchema>;
export type UpdateGradeInput = z.output<typeof updateGradeSchema>;
export type DeleteGradeInput = z.output<typeof deleteGradeSchema>;
export type CreateChapterInput = z.output<typeof createChapterSchema>;
export type UpdateChapterInput = z.output<typeof updateChapterSchema>;
export type DeleteChapterInput = z.output<typeof deleteChapterSchema>;
