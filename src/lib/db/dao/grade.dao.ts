import "server-only";

import type { ClientSession, Types } from "mongoose";

import { GradeModel } from "@/lib/db/models/grade.model";
import { connectToDatabase } from "@/lib/db/mongoose";

export interface GradePersistenceRecord {
  id: string;
  name: string;
  normalizedName: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface GradeDocumentData {
  _id: Types.ObjectId;
  name: string;
  normalizedName: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

let gradeIndexesPromise: Promise<void> | null = null;

async function prepareGradeModel(): Promise<void> {
  await connectToDatabase();

  if (!gradeIndexesPromise) {
    gradeIndexesPromise = GradeModel.init()
      .then(() => undefined)
      .catch((error: unknown) => {
        gradeIndexesPromise = null;
        throw error;
      });
  }

  await gradeIndexesPromise;
}

function toGradeRecord(grade: GradeDocumentData): GradePersistenceRecord {
  return {
    id: grade._id.toString(),
    name: grade.name,
    normalizedName: grade.normalizedName,
    sortOrder: grade.sortOrder,
    createdAt: grade.createdAt,
    updatedAt: grade.updatedAt,
  };
}

export async function listGradeRecords(
  session?: ClientSession,
): Promise<GradePersistenceRecord[]> {
  await prepareGradeModel();
  const query = GradeModel.find();
  if (session) {
    query.session(session);
  }
  const grades = await query
    .sort({ sortOrder: 1, normalizedName: 1, _id: 1 })
    .lean<GradeDocumentData[]>()
    .exec();
  return grades.map(toGradeRecord);
}

export async function reserveGradeRecordsByIds(
  gradeIds: string[],
  session: ClientSession,
): Promise<number> {
  const uniqueGradeIds = [...new Set(gradeIds)];
  if (uniqueGradeIds.length === 0) return 0;

  await prepareGradeModel();
  const result = await GradeModel.updateMany(
    { _id: { $in: uniqueGradeIds } },
    { $inc: { integrityRevision: 1 } },
    { session, timestamps: false },
  ).exec();
  return result.matchedCount;
}

export async function findGradeRecordById(
  gradeId: string,
): Promise<GradePersistenceRecord | null> {
  await prepareGradeModel();
  const grade = await GradeModel.findById(gradeId)
    .lean<GradeDocumentData>()
    .exec();
  return grade ? toGradeRecord(grade) : null;
}

export async function createGradeRecord(input: {
  name: string;
  normalizedName: string;
  sortOrder: number;
}): Promise<GradePersistenceRecord> {
  await prepareGradeModel();
  const grade = await GradeModel.create(input);
  return toGradeRecord(grade.toObject() as GradeDocumentData);
}

export async function updateGradeRecord(
  gradeId: string,
  input: { name: string; normalizedName: string; sortOrder: number },
  expectedUpdatedAt: Date,
): Promise<GradePersistenceRecord | null> {
  await prepareGradeModel();
  const grade = await GradeModel.findOneAndUpdate(
    { _id: gradeId, updatedAt: expectedUpdatedAt },
    { $set: input },
    { returnDocument: "after", runValidators: true },
  )
    .lean<GradeDocumentData>()
    .exec();
  return grade ? toGradeRecord(grade) : null;
}

export async function reserveGradeRecord(
  gradeId: string,
  session: ClientSession,
): Promise<boolean> {
  await prepareGradeModel();
  const result = await GradeModel.updateOne(
    { _id: gradeId },
    { $inc: { integrityRevision: 1 } },
    { session, timestamps: false },
  ).exec();
  return result.matchedCount === 1;
}

export async function deleteGradeRecord(
  gradeId: string,
  expectedUpdatedAt: Date,
  session: ClientSession,
): Promise<boolean> {
  await prepareGradeModel();
  const grade = await GradeModel.findOneAndDelete(
    { _id: gradeId, updatedAt: expectedUpdatedAt },
    { session },
  )
    .lean<GradeDocumentData>()
    .exec();
  return Boolean(grade);
}
