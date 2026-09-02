import "server-only";

import type { ClientSession, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { TopicModel } from "@/lib/db/models/topic.model";
import { normalizeTopicName } from "@/lib/utils/topic-name";

export interface TopicPersistenceRecord {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TopicDocumentData {
  _id: Types.ObjectId;
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

let topicIndexesPromise: Promise<void> | null = null;

async function prepareTopicModel(): Promise<void> {
  await connectToDatabase();

  if (!topicIndexesPromise) {
    topicIndexesPromise = TopicModel.init()
      .then(() => undefined)
      .catch((error: unknown) => {
        topicIndexesPromise = null;
        throw error;
      });
  }

  await topicIndexesPromise;
}

function toTopicRecord(topic: TopicDocumentData): TopicPersistenceRecord {
  return {
    id: topic._id.toString(),
    name: topic.name,
    normalizedName: topic.normalizedName,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
  };
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export async function listTopicRecords(
  search?: string,
): Promise<TopicPersistenceRecord[]> {
  await prepareTopicModel();
  const normalizedSearch = search ? normalizeTopicName(search) : "";
  const filter = normalizedSearch
    ? {
        normalizedName: {
          $regex: escapeRegularExpression(normalizedSearch),
        },
      }
    : {};
  const topics = await TopicModel.find(filter)
    .sort({ normalizedName: 1, _id: 1 })
    .lean<TopicDocumentData[]>()
    .exec();

  return topics.map(toTopicRecord);
}

export async function findTopicRecordByNormalizedName(
  normalizedName: string,
): Promise<TopicPersistenceRecord | null> {
  await prepareTopicModel();
  const topic = await TopicModel.findOne({ normalizedName })
    .lean<TopicDocumentData>()
    .exec();

  return topic ? toTopicRecord(topic) : null;
}

export async function findTopicRecordsByIds(
  topicIds: string[],
): Promise<TopicPersistenceRecord[]> {
  const uniqueTopicIds = [...new Set(topicIds)];

  if (uniqueTopicIds.length === 0) {
    return [];
  }

  await prepareTopicModel();
  const topics = await TopicModel.find({ _id: { $in: uniqueTopicIds } })
    .lean<TopicDocumentData[]>()
    .exec();

  return topics.map(toTopicRecord);
}

export async function createTopicRecord(input: {
  name: string;
  normalizedName: string;
}): Promise<TopicPersistenceRecord> {
  await prepareTopicModel();
  const topic = await TopicModel.create(input);

  return toTopicRecord(topic.toObject() as TopicDocumentData);
}

export async function countTopicRecordsByIds(
  topicIds: string[],
  session: ClientSession,
): Promise<number> {
  await prepareTopicModel();

  if (topicIds.length === 0) {
    return 0;
  }

  return TopicModel.countDocuments({ _id: { $in: topicIds } })
    .session(session)
    .exec();
}
