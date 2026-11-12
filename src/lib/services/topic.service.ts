import "server-only";

import type { ClientSession } from "mongoose";

import { USER_ROLE } from "@/lib/constants/roles";
import {
  findChapterRecordById,
  listChapterRecords,
  reserveChapterRecord,
  reserveChapterRecordsByIds,
} from "@/lib/db/dao/chapter.dao";
import {
  findExamReferencedTopicIds,
  hasExamRecordsWithTopicId,
} from "@/lib/db/dao/exam.dao";
import {
  listGradeRecords,
  reserveGradeRecordsByIds,
} from "@/lib/db/dao/grade.dao";
import {
  createTopicRecord,
  createTopicRecords,
  deleteTopicRecord,
  deleteTopicRecords,
  findTopicRecordByChapterAndNormalizedName,
  findTopicRecordById,
  findTopicRecordsByIds,
  listTopicRecords,
  reserveTopicRecordsByIds,
  updateTopicRecord,
  type TopicPersistenceRecord,
} from "@/lib/db/dao/topic.dao";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
import { withMongoTransaction } from "@/lib/db/mongoose";
import {
  ChapterNotFoundError,
  CurriculumConflictError,
  CurriculumNameConflictError,
  ForbiddenError,
  RequestValidationError,
  TopicInUseError,
  TopicBulkDeleteBlockedError,
  TopicBulkDeleteConflictError,
  TopicImportConflictError,
  TopicNotFoundError,
} from "@/lib/errors/app-error";
import {
  cleanCurriculumName,
  cleanTopicName,
  normalizeCurriculumName,
  normalizeTopicName,
} from "@/lib/utils/topic-name";
import {
  bulkDeleteTopicsSchema,
  createTopicSchema,
  deleteTopicSchema,
  topicImportSchema,
  topicNameSchema,
  updateTopicSchema,
  type CreateTopicInput,
  type BulkDeleteTopicsInput,
  type DeleteTopicInput,
  type TopicImportInput,
  type UpdateTopicInput,
} from "@/lib/validations/topic";
import {
  chapterNameSchema,
  gradeNameSchema,
} from "@/lib/validations/curriculum";
import type {
  Topic,
  TopicImportPreview,
  TopicImportPreviewItem,
  TopicImportResult,
} from "@/types/topic";
import type { AppUser } from "@/types/user";

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLE.ADMIN) {
    throw new ForbiddenError();
  }
}

function toTopic(topic: TopicPersistenceRecord): Topic {
  return {
    id: topic.id,
    name: topic.name,
    ...(topic.chapterId ? { chapterId: topic.chapterId } : {}),
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
  };
}

interface TopicImportPlan {
  preview: TopicImportPreview;
  createInputs: Array<{
    chapterId: string;
    name: string;
    normalizedName: string;
  }>;
  gradeIds: string[];
  chapterIds: string[];
}

async function buildTopicImportPlan(
  input: TopicImportInput,
  session?: ClientSession,
): Promise<TopicImportPlan> {
  const grades = await listGradeRecords(session);
  const chapters = await listChapterRecords(undefined, session);
  const topics = await listTopicRecords(undefined, session);
  const gradesByName = new Map(
    grades.map((grade) => [grade.normalizedName, grade]),
  );
  const chaptersByGradeAndName = new Map(
    chapters.map((chapter) => [
      `${chapter.gradeId}:${chapter.normalizedName}`,
      chapter,
    ]),
  );
  const existingTopicKeys = new Set(
    topics.flatMap((topic) =>
      topic.chapterId ? [`${topic.chapterId}:${topic.normalizedName}`] : [],
    ),
  );
  const importTopicKeys = new Set<string>();
  const items: TopicImportPreviewItem[] = [];
  const createInputs: TopicImportPlan["createInputs"] = [];
  const gradeIds = new Set<string>();
  const chapterIds = new Set<string>();

  for (const group of input.groups) {
    const gradeResult = gradeNameSchema.safeParse(group.grade);
    const chapterResult = chapterNameSchema.safeParse(group.chapter);
    const grade = gradeResult.success
      ? gradesByName.get(normalizeCurriculumName(gradeResult.data))
      : undefined;
    const chapter =
      grade && chapterResult.success
        ? chaptersByGradeAndName.get(
            `${grade.id}:${normalizeCurriculumName(chapterResult.data)}`,
          )
        : undefined;
    const hierarchyError = !gradeResult.success
      ? gradeResult.error.issues[0]?.message
      : !grade
        ? `Không tìm thấy khối “${cleanCurriculumName(group.grade)}”.`
        : !chapterResult.success
          ? chapterResult.error.issues[0]?.message
          : !chapter
            ? `Không tìm thấy chương “${cleanCurriculumName(group.chapter)}” trong khối “${grade.name}”.`
            : undefined;

    if (grade) gradeIds.add(grade.id);
    if (chapter) chapterIds.add(chapter.id);

    for (const rawTopicName of group.topics) {
      const topicResult = topicNameSchema.safeParse(rawTopicName);
      const topicName = topicResult.success
        ? topicResult.data
        : cleanTopicName(rawTopicName);
      const baseItem = {
        grade: cleanCurriculumName(group.grade),
        chapter: cleanCurriculumName(group.chapter),
        topic: topicName,
      };

      if (hierarchyError || !chapter) {
        items.push({
          ...baseItem,
          status: "ERROR",
          message: hierarchyError ?? "Phân cấp không hợp lệ.",
        });
        continue;
      }
      if (!topicResult.success) {
        items.push({
          ...baseItem,
          status: "ERROR",
          message:
            topicResult.error.issues[0]?.message ?? "Tên chủ đề không hợp lệ.",
        });
        continue;
      }

      const normalizedName = normalizeTopicName(topicName);
      const key = `${chapter.id}:${normalizedName}`;
      if (importTopicKeys.has(key)) {
        items.push({
          ...baseItem,
          status: "ERROR",
          message: "Chủ đề bị lặp trong tệp nhập ở cùng một chương.",
        });
      } else if (existingTopicKeys.has(key)) {
        importTopicKeys.add(key);
        items.push({ ...baseItem, status: "SKIP_EXISTING" });
      } else {
        importTopicKeys.add(key);
        items.push({ ...baseItem, status: "CREATE" });
        createInputs.push({
          chapterId: chapter.id,
          name: topicName,
          normalizedName,
        });
      }
    }
  }

  const summary = {
    totalCount: items.length,
    createCount: items.filter((item) => item.status === "CREATE").length,
    skippedCount: items.filter((item) => item.status === "SKIP_EXISTING")
      .length,
    errorCount: items.filter((item) => item.status === "ERROR").length,
  };
  return {
    preview: { items, summary, canImport: summary.errorCount === 0 },
    createInputs,
    gradeIds: [...gradeIds],
    chapterIds: [...chapterIds],
  };
}

export async function listTopics(
  actor: AppUser,
  search?: string,
): Promise<Topic[]> {
  assertAdmin(actor);
  const topics = await listTopicRecords(search);
  return topics.map(toTopic);
}

export async function createTopic(
  actor: AppUser,
  input: CreateTopicInput,
): Promise<{ topic: Topic; created: boolean }> {
  assertAdmin(actor);
  const validatedInput = createTopicSchema.parse(input);

  if (!(await findChapterRecordById(validatedInput.chapterId))) {
    throw new ChapterNotFoundError();
  }

  const name = cleanTopicName(validatedInput.name);
  const normalizedName = normalizeTopicName(name);

  try {
    const topic = await withMongoTransaction(async (session) => {
      if (!(await reserveChapterRecord(validatedInput.chapterId, session))) {
        throw new ChapterNotFoundError();
      }
      return createTopicRecord(
        {
          chapterId: validatedInput.chapterId,
          name,
          normalizedName,
        },
        session,
      );
    });
    return { topic: toTopic(topic), created: true };
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      const existingTopic = await findTopicRecordByChapterAndNormalizedName(
        validatedInput.chapterId,
        normalizedName,
      );

      if (existingTopic) {
        return { topic: toTopic(existingTopic), created: false };
      }
    }

    throw error;
  }
}

export async function editTopic(
  actor: AppUser,
  topicId: string,
  input: UpdateTopicInput,
): Promise<Topic> {
  assertAdmin(actor);
  const validatedInput = updateTopicSchema.parse(input);
  const [currentTopic, destinationChapter] = await Promise.all([
    findTopicRecordById(topicId),
    findChapterRecordById(validatedInput.chapterId),
  ]);

  if (!currentTopic) {
    throw new TopicNotFoundError();
  }
  if (!destinationChapter) {
    throw new ChapterNotFoundError();
  }
  if (
    currentTopic.updatedAt.getTime() !==
    new Date(validatedInput.expectedUpdatedAt).getTime()
  ) {
    throw new CurriculumConflictError("chủ đề");
  }

  const name = cleanTopicName(validatedInput.name);
  try {
    const topic = await withMongoTransaction(async (session) => {
      if (!(await reserveChapterRecord(validatedInput.chapterId, session))) {
        throw new ChapterNotFoundError();
      }
      const updatedTopic = await updateTopicRecord(
        topicId,
        {
          chapterId: validatedInput.chapterId,
          name,
          normalizedName: normalizeTopicName(name),
        },
        currentTopic.updatedAt,
        session,
      );
      if (!updatedTopic) {
        throw new CurriculumConflictError("chủ đề");
      }
      return updatedTopic;
    });
    return toTopic(topic);
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw new CurriculumNameConflictError("chủ đề");
    }
    throw error;
  }
}

export async function deleteTopic(
  actor: AppUser,
  topicId: string,
  input: DeleteTopicInput,
): Promise<void> {
  assertAdmin(actor);
  const validatedInput = deleteTopicSchema.parse(input);
  const currentTopic = await findTopicRecordById(topicId);

  if (!currentTopic) {
    throw new TopicNotFoundError();
  }
  if (
    currentTopic.updatedAt.getTime() !==
    new Date(validatedInput.expectedUpdatedAt).getTime()
  ) {
    throw new CurriculumConflictError("chủ đề");
  }

  await withMongoTransaction(async (session) => {
    if ((await reserveTopicRecordsByIds([topicId], session)) !== 1) {
      throw new CurriculumConflictError("chủ đề");
    }
    if (await hasExamRecordsWithTopicId(topicId, session)) {
      throw new TopicInUseError();
    }
    if (!(await deleteTopicRecord(topicId, currentTopic.updatedAt, session))) {
      throw new CurriculumConflictError("chủ đề");
    }
  });
}

export async function bulkDeleteTopics(
  actor: AppUser,
  input: BulkDeleteTopicsInput,
): Promise<{ deletedCount: number }> {
  assertAdmin(actor);
  const validatedInput = bulkDeleteTopicsSchema.parse(input);

  return withMongoTransaction(async (session) => {
    const topicIds = validatedInput.topics.map((topic) => topic.id);
    if (
      (await reserveTopicRecordsByIds(topicIds, session)) !== topicIds.length
    ) {
      const existingIds = new Set(
        (await findTopicRecordsByIds(topicIds, session)).map(
          (topic) => topic.id,
        ),
      );
      throw new TopicBulkDeleteConflictError(
        topicIds.filter((topicId) => !existingIds.has(topicId)),
      );
    }

    const topics = await findTopicRecordsByIds(topicIds, session);
    const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
    const staleTopics = validatedInput.topics.filter((inputTopic) => {
      const topic = topicsById.get(inputTopic.id);
      return (
        !topic ||
        topic.updatedAt.getTime() !==
          new Date(inputTopic.expectedUpdatedAt).getTime()
      );
    });
    if (staleTopics.length > 0) {
      throw new TopicBulkDeleteConflictError(
        staleTopics.map(
          (inputTopic) => topicsById.get(inputTopic.id)?.name ?? inputTopic.id,
        ),
      );
    }

    const referencedIds = await findExamReferencedTopicIds(topicIds, session);
    if (referencedIds.length > 0) {
      throw new TopicBulkDeleteBlockedError(
        referencedIds.map(
          (topicId) => topicsById.get(topicId)?.name ?? topicId,
        ),
      );
    }

    const deletedCount = await deleteTopicRecords(
      validatedInput.topics.map((topic) => ({
        id: topic.id,
        expectedUpdatedAt: new Date(topic.expectedUpdatedAt),
      })),
      session,
    );
    if (deletedCount !== topicIds.length) {
      throw new TopicBulkDeleteConflictError(topics.map((topic) => topic.name));
    }
    return { deletedCount };
  });
}

export async function previewTopicImport(
  actor: AppUser,
  input: TopicImportInput,
): Promise<TopicImportPreview> {
  assertAdmin(actor);
  const validatedInput = topicImportSchema.parse(input);
  return (await buildTopicImportPlan(validatedInput)).preview;
}

export async function importTopics(
  actor: AppUser,
  input: TopicImportInput,
): Promise<TopicImportResult> {
  assertAdmin(actor);
  const validatedInput = topicImportSchema.parse(input);

  try {
    return await withMongoTransaction(async (session) => {
      const plan = await buildTopicImportPlan(validatedInput, session);
      const firstError = plan.preview.items.find(
        (item) => item.status === "ERROR",
      );
      if (firstError) {
        throw new RequestValidationError(
          `${firstError.grade} / ${firstError.chapter} / ${firstError.topic}: ${firstError.message}`,
        );
      }

      if (
        (await reserveGradeRecordsByIds(plan.gradeIds, session)) !==
          plan.gradeIds.length ||
        (await reserveChapterRecordsByIds(plan.chapterIds, session)) !==
          plan.chapterIds.length
      ) {
        throw new TopicImportConflictError();
      }

      await createTopicRecords(plan.createInputs, session);
      return {
        createdCount: plan.createInputs.length,
        skippedCount: plan.preview.summary.skippedCount,
      };
    });
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw new TopicImportConflictError();
    }
    throw error;
  }
}
