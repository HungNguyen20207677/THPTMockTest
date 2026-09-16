import { z } from "zod";

import { TOPIC_NAME_MAX_LENGTH } from "@/lib/constants/topic";
import { cleanTopicName, normalizeTopicName } from "@/lib/utils/topic-name";
import { chapterIdSchema } from "@/lib/validations/curriculum";

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
