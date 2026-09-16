import "server-only";

import { USER_ROLE } from "@/lib/constants/roles";
import {
  findChapterRecordById,
  reserveChapterRecord,
} from "@/lib/db/dao/chapter.dao";
import { hasExamRecordsWithTopicId } from "@/lib/db/dao/exam.dao";
import {
  createTopicRecord,
  deleteTopicRecord,
  findTopicRecordByChapterAndNormalizedName,
  findTopicRecordById,
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
  TopicInUseError,
  TopicNotFoundError,
} from "@/lib/errors/app-error";
import { cleanTopicName, normalizeTopicName } from "@/lib/utils/topic-name";
import {
  createTopicSchema,
  deleteTopicSchema,
  updateTopicSchema,
  type CreateTopicInput,
  type DeleteTopicInput,
  type UpdateTopicInput,
} from "@/lib/validations/topic";
import type { Topic } from "@/types/topic";
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
