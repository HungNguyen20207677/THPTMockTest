import "server-only";

import type { ClientSession, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { TopicModel } from "@/lib/db/models/topic.model";
import { normalizeTopicName } from "@/lib/utils/topic-name";

export interface TopicPersistenceRecord {
  id: string;
  chapterId?: string;
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TopicDocumentData {
  _id: Types.ObjectId;
  chapterId?: Types.ObjectId;
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

let topicIndexesPromise: Promise<void> | null = null;

function isIndexNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 27) ||
      ("codeName" in error && error.codeName === "IndexNotFound"))
  );
}

async function removeLegacyGlobalNameIndex(): Promise<void> {
  const indexes = await TopicModel.collection.indexes();
  const legacyIndex = indexes.find(
    (index) =>
      index.unique === true &&
      !index.partialFilterExpression &&
      Object.keys(index.key).length === 1 &&
      index.key.normalizedName === 1,
  );

  if (!legacyIndex?.name) {
    return;
  }

  try {
    await TopicModel.collection.dropIndex(legacyIndex.name);
  } catch (error) {
    if (!isIndexNotFoundError(error)) {
      throw error;
    }
  }
}

async function prepareTopicModel(): Promise<void> {
  await connectToDatabase();

  if (!topicIndexesPromise) {
    topicIndexesPromise = TopicModel.init()
      .then(removeLegacyGlobalNameIndex)
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
    ...(topic.chapterId ? { chapterId: topic.chapterId.toString() } : {}),
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

export async function findTopicRecordById(
  topicId: string,
): Promise<TopicPersistenceRecord | null> {
  await prepareTopicModel();
  const topic = await TopicModel.findById(topicId)
    .lean<TopicDocumentData>()
    .exec();
  return topic ? toTopicRecord(topic) : null;
}

export async function findTopicRecordByChapterAndNormalizedName(
  chapterId: string,
  normalizedName: string,
): Promise<TopicPersistenceRecord | null> {
  await prepareTopicModel();
  const topic = await TopicModel.findOne({ chapterId, normalizedName })
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

export async function createTopicRecord(
  input: {
    chapterId: string;
    name: string;
    normalizedName: string;
  },
  session: ClientSession,
): Promise<TopicPersistenceRecord> {
  await prepareTopicModel();
  const topic = new TopicModel(input);
  await topic.save({ session });

  return toTopicRecord(topic.toObject() as TopicDocumentData);
}

export async function updateTopicRecord(
  topicId: string,
  input: { chapterId: string; name: string; normalizedName: string },
  expectedUpdatedAt: Date,
  session: ClientSession,
): Promise<TopicPersistenceRecord | null> {
  await prepareTopicModel();
  const topic = await TopicModel.findOneAndUpdate(
    { _id: topicId, updatedAt: expectedUpdatedAt },
    { $set: input },
    { returnDocument: "after", runValidators: true, session },
  )
    .lean<TopicDocumentData>()
    .exec();
  return topic ? toTopicRecord(topic) : null;
}

export async function deleteTopicRecord(
  topicId: string,
  expectedUpdatedAt: Date,
  session: ClientSession,
): Promise<boolean> {
  await prepareTopicModel();
  const topic = await TopicModel.findOneAndDelete(
    { _id: topicId, updatedAt: expectedUpdatedAt },
    { session },
  )
    .lean<TopicDocumentData>()
    .exec();
  return Boolean(topic);
}

export async function hasTopicRecordsForChapter(
  chapterId: string,
  session: ClientSession,
): Promise<boolean> {
  await prepareTopicModel();
  return Boolean(await TopicModel.exists({ chapterId }).session(session));
}

export async function reserveTopicRecordsByIds(
  topicIds: string[],
  session: ClientSession,
): Promise<number> {
  const uniqueTopicIds = [...new Set(topicIds)];

  if (uniqueTopicIds.length === 0) {
    return 0;
  }

  await prepareTopicModel();
  const result = await TopicModel.updateMany(
    { _id: { $in: uniqueTopicIds } },
    { $inc: { integrityRevision: 1 } },
    { session, timestamps: false },
  ).exec();
  return result.matchedCount;
}
