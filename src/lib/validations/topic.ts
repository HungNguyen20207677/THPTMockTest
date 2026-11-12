import { z } from "zod";

import { TOPIC_NAME_MAX_LENGTH } from "@/lib/constants/topic";
import { cleanTopicName, normalizeTopicName } from "@/lib/utils/topic-name";
import { chapterIdSchema } from "@/lib/validations/curriculum";

export const MAX_TOPIC_BULK_ITEMS = 200;
export const MAX_TOPIC_IMPORT_GROUPS = 200;

export const topicIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Mã chủ đề không hợp lệ.")
  .transform((topicId) => topicId.toLowerCase());

export const topicNameSchema = z
  .string()
  .transform(cleanTopicName)
  .pipe(
    z
      .string()
      .min(1, "Tên chủ đề là bắt buộc.")
      .max(
        TOPIC_NAME_MAX_LENGTH,
        `Tên chủ đề không được vượt quá ${TOPIC_NAME_MAX_LENGTH} ký tự.`,
      ),
  )
  .refine(
    (name) => normalizeTopicName(name).length <= TOPIC_NAME_MAX_LENGTH,
    `Tên chủ đề không được vượt quá ${TOPIC_NAME_MAX_LENGTH} ký tự sau khi chuẩn hóa.`,
  );

export const createTopicSchema = z.strictObject({
  chapterId: chapterIdSchema,
  name: topicNameSchema,
});

export const updateTopicSchema = createTopicSchema.extend({
  expectedUpdatedAt: z.string().datetime(),
});

export const deleteTopicSchema = z.strictObject({
  expectedUpdatedAt: z.string().datetime(),
});

export const bulkDeleteTopicsSchema = z
  .strictObject({
    topics: z
      .array(
        z.strictObject({
          id: topicIdSchema,
          expectedUpdatedAt: z.string().datetime(),
        }),
      )
      .min(1, "Vui lòng chọn ít nhất một chủ đề.")
      .max(
        MAX_TOPIC_BULK_ITEMS,
        `Chỉ có thể xóa tối đa ${MAX_TOPIC_BULK_ITEMS} chủ đề mỗi lần.`,
      ),
  })
  .transform(({ topics }) => ({
    topics: [...new Map(topics.map((topic) => [topic.id, topic])).values()],
  }));

export const topicImportSchema = z
  .strictObject({
    groups: z
      .array(
        z.strictObject({
          grade: z.string().max(200, "Tên khối quá dài."),
          chapter: z.string().max(200, "Tên chương quá dài."),
          topics: z
            .array(z.string().max(500, "Tên chủ đề quá dài."))
            .min(1, "Mỗi nhóm phải có ít nhất một chủ đề."),
        }),
      )
      .min(1, "Tệp nhập phải có ít nhất một nhóm.")
      .max(
        MAX_TOPIC_IMPORT_GROUPS,
        `Tệp nhập chỉ được có tối đa ${MAX_TOPIC_IMPORT_GROUPS} nhóm.`,
      ),
  })
  .superRefine(({ groups }, context) => {
    const topicCount = groups.reduce(
      (count, group) => count + group.topics.length,
      0,
    );
    if (topicCount > MAX_TOPIC_BULK_ITEMS) {
      context.addIssue({
        code: "custom",
        message: `Chỉ có thể nhập tối đa ${MAX_TOPIC_BULK_ITEMS} chủ đề mỗi lần.`,
        path: ["groups"],
      });
    }
  });

export const listTopicsQuerySchema = z.strictObject({
  q: z
    .string()
    .transform(cleanTopicName)
    .pipe(z.string().max(TOPIC_NAME_MAX_LENGTH, "Từ khóa tìm kiếm quá dài."))
    .transform((search) => search || undefined)
    .optional(),
});

export type CreateTopicInput = z.output<typeof createTopicSchema>;
export type UpdateTopicInput = z.output<typeof updateTopicSchema>;
export type DeleteTopicInput = z.output<typeof deleteTopicSchema>;
export type BulkDeleteTopicsInput = z.output<typeof bulkDeleteTopicsSchema>;
export type TopicImportInput = z.output<typeof topicImportSchema>;
