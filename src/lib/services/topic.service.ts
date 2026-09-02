import "server-only";

import { USER_ROLE } from "@/lib/constants/roles";
import {
  createTopicRecord,
  findTopicRecordByNormalizedName,
  listTopicRecords,
  type TopicPersistenceRecord,
} from "@/lib/db/dao/topic.dao";
import { isMongoDuplicateKeyError } from "@/lib/db/errors";
import { ForbiddenError } from "@/lib/errors/app-error";
import { cleanTopicName, normalizeTopicName } from "@/lib/utils/topic-name";
import type { CreateTopicInput } from "@/lib/validations/topic";
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
  const name = cleanTopicName(input.name);
  const normalizedName = normalizeTopicName(name);

  try {
    const topic = await createTopicRecord({ name, normalizedName });
    return { topic: toTopic(topic), created: true };
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      const existingTopic =
        await findTopicRecordByNormalizedName(normalizedName);

      if (existingTopic) {
        return { topic: toTopic(existingTopic), created: false };
      }
    }

    throw error;
  }
}
