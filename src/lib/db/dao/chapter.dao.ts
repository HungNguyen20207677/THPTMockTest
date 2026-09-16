import "server-only";

import type { ClientSession, Types } from "mongoose";

import { ChapterModel } from "@/lib/db/models/chapter.model";
import { connectToDatabase } from "@/lib/db/mongoose";

export interface ChapterPersistenceRecord {
  id: string;
  gradeId: string;
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChapterDocumentData {
  _id: Types.ObjectId;
  gradeId: Types.ObjectId;
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

let chapterIndexesPromise: Promise<void> | null = null;

async function prepareChapterModel(): Promise<void> {
  await connectToDatabase();

  if (!chapterIndexesPromise) {
    chapterIndexesPromise = ChapterModel.init()
      .then(() => undefined)
      .catch((error: unknown) => {
        chapterIndexesPromise = null;
        throw error;
      });
  }

  await chapterIndexesPromise;
}

function toChapterRecord(
  chapter: ChapterDocumentData,
): ChapterPersistenceRecord {
  return {
    id: chapter._id.toString(),
    gradeId: chapter.gradeId.toString(),
    name: chapter.name,
    normalizedName: chapter.normalizedName,
    createdAt: chapter.createdAt,
    updatedAt: chapter.updatedAt,
  };
}

export async function listChapterRecords(
  gradeId?: string,
): Promise<ChapterPersistenceRecord[]> {
  await prepareChapterModel();
  const chapters = await ChapterModel.find(gradeId ? { gradeId } : {})
    .sort({ normalizedName: 1, _id: 1 })
    .lean<ChapterDocumentData[]>()
    .exec();
  return chapters.map(toChapterRecord);
}

export async function findChapterRecordById(
  chapterId: string,
): Promise<ChapterPersistenceRecord | null> {
  await prepareChapterModel();
  const chapter = await ChapterModel.findById(chapterId)
    .lean<ChapterDocumentData>()
    .exec();
  return chapter ? toChapterRecord(chapter) : null;
}

export async function createChapterRecord(
  input: {
    gradeId: string;
    name: string;
    normalizedName: string;
  },
  session: ClientSession,
): Promise<ChapterPersistenceRecord> {
  await prepareChapterModel();
  const chapter = new ChapterModel(input);
  await chapter.save({ session });
  return toChapterRecord(chapter.toObject() as ChapterDocumentData);
}

export async function updateChapterRecord(
  chapterId: string,
  input: { gradeId: string; name: string; normalizedName: string },
  expectedUpdatedAt: Date,
  session: ClientSession,
): Promise<ChapterPersistenceRecord | null> {
  await prepareChapterModel();
  const chapter = await ChapterModel.findOneAndUpdate(
    { _id: chapterId, updatedAt: expectedUpdatedAt },
    { $set: input },
    { returnDocument: "after", runValidators: true, session },
  )
    .lean<ChapterDocumentData>()
    .exec();
  return chapter ? toChapterRecord(chapter) : null;
}

export async function reserveChapterRecord(
  chapterId: string,
  session: ClientSession,
): Promise<boolean> {
  await prepareChapterModel();
  const result = await ChapterModel.updateOne(
    { _id: chapterId },
    { $inc: { integrityRevision: 1 } },
    { session, timestamps: false },
  ).exec();
  return result.matchedCount === 1;
}

export async function deleteChapterRecord(
  chapterId: string,
  expectedUpdatedAt: Date,
  session: ClientSession,
): Promise<boolean> {
  await prepareChapterModel();
  const chapter = await ChapterModel.findOneAndDelete(
    { _id: chapterId, updatedAt: expectedUpdatedAt },
    { session },
  )
    .lean<ChapterDocumentData>()
    .exec();
  return Boolean(chapter);
}

export async function hasChapterRecordsForGrade(
  gradeId: string,
  session: ClientSession,
): Promise<boolean> {
  await prepareChapterModel();
  return Boolean(await ChapterModel.exists({ gradeId }).session(session));
}
