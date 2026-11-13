import { z } from "zod";

import { examStructureTemplateIdSchema } from "@/lib/validations/exam-structure-template";
import { examIdSchema } from "@/lib/validations/exam";
import { studentIdSchema } from "@/lib/validations/user";

export const MAX_ADMIN_BULK_DELETE_ITEMS = 25;

function uniqueItemsSchema<T extends z.ZodType<{ id: string }>>(item: T) {
  return z
    .array(item)
    .min(1, "Vui lòng chọn ít nhất một bản ghi.")
    .max(
      MAX_ADMIN_BULK_DELETE_ITEMS,
      `Chỉ có thể xóa tối đa ${MAX_ADMIN_BULK_DELETE_ITEMS} bản ghi mỗi lần.`,
    )
    .refine(
      (items) => new Set(items.map((value) => value.id)).size === items.length,
      "Danh sách xóa chứa mã bản ghi trùng lặp.",
    );
}

export const bulkDeleteStudentsSchema = z.strictObject({
  items: uniqueItemsSchema(z.strictObject({ id: studentIdSchema })),
});

export const bulkDeleteExamsSchema = z.strictObject({
  items: uniqueItemsSchema(
    z.strictObject({
      id: examIdSchema,
      expectedUpdatedAt: z.string().datetime(),
    }),
  ),
});

export const bulkDeleteExamStructureTemplatesSchema = z.strictObject({
  items: uniqueItemsSchema(
    z.strictObject({
      id: examStructureTemplateIdSchema,
      expectedUpdatedAt: z.string().datetime(),
    }),
  ),
});

export type BulkDeleteStudentsInput = z.output<typeof bulkDeleteStudentsSchema>;
export type BulkDeleteExamsInput = z.output<typeof bulkDeleteExamsSchema>;
export type BulkDeleteExamStructureTemplatesInput = z.output<
  typeof bulkDeleteExamStructureTemplatesSchema
>;
